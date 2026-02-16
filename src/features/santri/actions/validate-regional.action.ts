"use server";

import prisma from "@/lib/prisma";
import { logger } from "@/server/logger";

export type RegionalValidationInput = {
  idApi: string;
  provinceName: string | null;
  regencyName: string | null;
};

export type RegionalValidationResult = {
  provinceId: number | null;
  regencyId: number | null;
};

export type ValidateRegionalResponse = {
  success: boolean;
  total: number;
  successCount: number;
  failedCount: number;
  /** Map<idApi, { provinceId, regencyId }> serialized as entries */
  validationEntries: Array<[string, RegionalValidationResult]>;
  errors: string[];
};

/**
 * Validate and map old address data (alamat) to database Province/Regency IDs.
 *
 * Strategy:
 * 1. Collect unique Province names from input
 * 2. Batch search Province by name (case-insensitive)
 * 3. For found Provinces, batch search Regency by name within those Provinces
 * 4. If exactly 1 match → success, if 0 or >1 → fail (leave null)
 */
export async function validateRegionalData(
  inputs: RegionalValidationInput[],
): Promise<ValidateRegionalResponse> {
  const errors: string[] = [];

  if (!inputs.length) {
    return {
      success: true,
      total: 0,
      successCount: 0,
      failedCount: 0,
      validationEntries: [],
      errors: [],
    };
  }

  try {
    // 1. Collect unique province names
    const uniqueProvinceNames = Array.from(
      new Set(
        inputs
          .map((i) => i.provinceName?.trim().toLowerCase())
          .filter((n): n is string => !!n),
      ),
    );

    // 2. Batch fetch all provinces that match any of the names
    const allProvinces = await prisma.province.findMany({
      select: { id: true, name: true },
    });

    // Build a map: lowercased name → Province[] (for ambiguity detection)
    const provinceByName = new Map<string, { id: number; name: string }[]>();
    for (const p of allProvinces) {
      const key = p.name.trim().toLowerCase();
      const arr = provinceByName.get(key) ?? [];
      arr.push(p);
      provinceByName.set(key, arr);
    }

    // DEBUG: Log sample input and DB province names
    const sampleInput = inputs[0];
    const dbProvinceKeys = Array.from(provinceByName.keys()).slice(0, 10);
    logger.info(
      {
        sampleInput: {
          idApi: sampleInput.idApi,
          provinceName: sampleInput.provinceName,
          regencyName: sampleInput.regencyName,
          provinceNameLower: sampleInput.provinceName?.trim().toLowerCase(),
        },
        dbProvinceKeySamples: dbProvinceKeys,
        totalDbProvinces: allProvinces.length,
        totalUniqueInputProvinces: uniqueProvinceNames.length,
        inputProvinceSamples: uniqueProvinceNames.slice(0, 5),
      },
      "santri.validateRegional DEBUG: sample data",
    );

    // 3. Determine which provinces were uniquely matched
    const matchedProvinceIds = new Set<number>();
    const provinceNameToId = new Map<string, number | null>();

    for (const name of uniqueProvinceNames) {
      const matches = provinceByName.get(name);
      if (!matches || matches.length === 0) {
        provinceNameToId.set(name, null);
      } else if (matches.length > 1) {
        // Ambiguous → fail
        provinceNameToId.set(name, null);
        errors.push(`Provinsi "${name}": ditemukan ${matches.length} hasil, diabaikan`);
      } else {
        provinceNameToId.set(name, matches[0].id);
        matchedProvinceIds.add(matches[0].id);
      }
    }

    // DEBUG: Log province match results
    logger.info(
      {
        matchedProvinceCount: matchedProvinceIds.size,
        unmatchedProvinces: uniqueProvinceNames.filter((n) => !provinceNameToId.get(n)).slice(0, 5),
        matchedProvinces: uniqueProvinceNames.filter((n) => provinceNameToId.get(n)).slice(0, 5),
      },
      "santri.validateRegional DEBUG: province match results",
    );

    // 4. Batch fetch all regencies within matched provinces
    const allRegencies = await prisma.regency.findMany({
      where: { provinceId: { in: Array.from(matchedProvinceIds) } },
      select: { id: true, name: true, label: true, provinceId: true },
    });

    // Build map: `${provinceId}:${lowercased regency name}` → Regency[]
    // Use `name` field (plain name like "Jepara") instead of `label` (has prefix like "Kab. Jepara")
    const regencyByKey = new Map<string, { id: number; name: string }[]>();
    for (const r of allRegencies) {
      const key = `${r.provinceId}:${r.name.trim().toLowerCase()}`;
      const arr = regencyByKey.get(key) ?? [];
      arr.push(r);
      regencyByKey.set(key, arr);
    }

    // DEBUG: Log regency match data
    const sampleInputForReg = inputs.find((i) => {
      const pn = i.provinceName?.trim().toLowerCase();
      return pn && provinceNameToId.get(pn);
    });
    if (sampleInputForReg) {
      const pId = provinceNameToId.get(sampleInputForReg.provinceName!.trim().toLowerCase());
      const inputRegKey = `${pId}:${sampleInputForReg.regencyName?.trim().toLowerCase()}`;
      const dbRegKeysForProvince = Array.from(regencyByKey.keys())
        .filter((k) => k.startsWith(`${pId}:`))
        .slice(0, 10);
      logger.info(
        {
          sampleInputRegency: sampleInputForReg.regencyName,
          sampleInputRegencyLower: sampleInputForReg.regencyName?.trim().toLowerCase(),
          lookupKey: inputRegKey,
          dbRegencyKeysForSameProvince: dbRegKeysForProvince,
          totalRegenciesFetched: allRegencies.length,
          sampleDbRegency: allRegencies.find((r) => r.provinceId === pId),
        },
        "santri.validateRegional DEBUG: regency match data",
      );
    }

    // 5. Match each input
    let successCount = 0;
    let failedCount = 0;
    const validationEntries: Array<[string, RegionalValidationResult]> = [];

    for (const input of inputs) {
      const provName = input.provinceName?.trim().toLowerCase();
      const regName = input.regencyName?.trim().toLowerCase();

      if (!provName || !regName) {
        failedCount++;
        validationEntries.push([input.idApi, { provinceId: null, regencyId: null }]);
        continue;
      }

      const provinceId = provinceNameToId.get(provName) ?? null;
      if (!provinceId) {
        failedCount++;
        validationEntries.push([input.idApi, { provinceId: null, regencyId: null }]);
        continue;
      }

      const regKey = `${provinceId}:${regName}`;
      const regMatches = regencyByKey.get(regKey);

      if (!regMatches || regMatches.length === 0) {
        failedCount++;
        validationEntries.push([input.idApi, { provinceId, regencyId: null }]);
        continue;
      }

      if (regMatches.length > 1) {
        failedCount++;
        errors.push(
          `Kabupaten "${regName}" di provinsi ${provName}: ditemukan ${regMatches.length} hasil, diabaikan`,
        );
        validationEntries.push([input.idApi, { provinceId, regencyId: null }]);
        continue;
      }

      // Exactly 1 match → success
      successCount++;
      validationEntries.push([
        input.idApi,
        { provinceId, regencyId: regMatches[0].id },
      ]);
    }

    logger.info(
      { total: inputs.length, successCount, failedCount },
      "santri.validateRegional completed",
    );

    return {
      success: true,
      total: inputs.length,
      successCount,
      failedCount,
      validationEntries,
      errors,
    };
  } catch (error) {
    logger.error({ err: error }, "santri.validateRegional failed");
    return {
      success: false,
      total: inputs.length,
      successCount: 0,
      failedCount: inputs.length,
      validationEntries: [],
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}
