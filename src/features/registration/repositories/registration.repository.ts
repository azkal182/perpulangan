import prisma from "@/lib/prisma";
import { logger } from "@/server/logger";
import {
  Registration,
  RegistrationStatus,
  type Prisma,
} from "@/generated/prisma/client";

export type RegistrationCreateData = {
  eventId: string;
  studentId?: string | null;
  externalParticipantId?: string | null;
  journeys?: Array<{
    direction: "OUTBOUND" | "RETURN";
    destinationKordaId: string;
    destinationKordaNameSnapshot: string;
    dropPointId: string;
    locationNameSnapshot: string;
    travelDate?: Date | null;
    tariffSnapshot: number;
  }>;
  registrarUserId?: string;
  originKordaId?: string | null;
  originKordaNameSnapshot?: string | null;
  // Optional outbound journey (for return-only registration)
  outboundKordaId: string | null;
  outboundDropPointId: string | null;
  outboundDate?: Date | null;
  // Optional return journey (can be cancelled)
  returnKordaId: string | null;
  returnDropPointId: string | null;
  returnDate?: Date | null;
  outboundPaid?: boolean;
  returnPaid?: boolean;
  kordaChanged?: boolean;
  kordaChangeConfirmed?: boolean;
  // Required registrar info
  registrarName: string;
  registrarPhone: string;
  notes?: string;
};

export type RegistrationUpdateData = Partial<RegistrationCreateData> & {
  outboundPaid?: boolean;
  returnPaid?: boolean;
  status?: RegistrationStatus;
  cancelledAt?: Date;
  cancelReason?: string;
  refundAmount?: number;
};

const registrationSelect = {
  id: true,
  eventId: true,
  studentId: true,
  student: {
    select: {
      name: true,
      nis: true,
      regency: {
        select: {
          kordaId: true,
        },
      },
    },
  },
  externalParticipant: { select: { id: true, name: true, gender: true, address: true } },
  outboundKordaId: true,
  outboundKorda: { select: { id: true, name: true } },
  outboundDropPointId: true,
  outboundDropPoint: { select: { id: true, name: true, price: true } },
  outboundPaid: true,
  returnKordaId: true,
  returnKorda: { select: { id: true, name: true } },
  returnDropPointId: true,
  returnDropPoint: { select: { id: true, name: true, price: true } },
  returnPaid: true,
  status: true,
  kordaChanged: true,
  kordaChangeConfirmed: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  cancelledAt: true,
  cancelReason: true,
  refundAmount: true,
};

export const registrationRepository = {
  async findMany(params?: {
    eventId?: string;
    studentId?: string;
    status?: RegistrationStatus;
    where?: Prisma.RegistrationWhereInput;
  }): Promise<Registration[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};
      if (params?.eventId) where.eventId = params.eventId;
      if (params?.studentId) where.studentId = params.studentId;
      if (params?.status) where.status = params.status;
      if (params?.where) {
        if (Object.keys(where).length > 0) {
          where.AND = [params.where];
        } else {
          Object.assign(where, params.where);
        }
      }

      const items = await prisma.registration.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: { createdAt: "desc" },
        select: registrationSelect,
      });

      const normalized = items.map((item) => item.student ? item : ({
        ...item,
        student: item.externalParticipant ? {
          name: item.externalParticipant.name,
          nis: null,
          parrentPhone: null,
          regency: { kordaId: null },
        } : null,
      }));
      logger.debug(
        { count: items.length, params },
        "registrationRepository.findMany success"
      );
      return normalized as unknown as Registration[];
    } catch (error) {
      logger.error(
        { err: error, params },
        "registrationRepository.findMany failed"
      );
      throw error;
    }
  },

  async findById(
    id: string,
    where?: Prisma.RegistrationWhereInput,
  ): Promise<Registration | null> {
    try {
      const item = await prisma.registration.findFirst({
        where: where ? { AND: [{ id }, where] } : { id },
        select: registrationSelect,
      });
      const normalized = item && !item.student && item.externalParticipant ? {
        ...item,
        student: {
          name: item.externalParticipant.name,
          nis: null,
          parrentPhone: null,
          regency: { kordaId: null },
        },
      } : item;
      logger.debug(
        { id, found: !!item },
        "registrationRepository.findById success"
      );
      return normalized as unknown as Registration;
    } catch (error) {
      logger.error({ err: error, id }, "registrationRepository.findById failed");
      throw error;
    }
  },

  async create(data: RegistrationCreateData, tx?: Prisma.TransactionClient): Promise<Registration> {
    try {
      const client = tx ?? prisma;
      const result = await client.registration.create({
        data: {
          eventId: data.eventId,
          studentId: data.studentId ?? null,
          externalParticipantId: data.externalParticipantId ?? null,
          registrarUserId: data.registrarUserId,
          originKordaId: data.originKordaId,
          originKordaNameSnapshot: data.originKordaNameSnapshot,
          journeys: data.journeys ? { create: data.journeys.map((journey) => {
            const { dropPointId, ...snapshot } = journey;
            return { ...snapshot, dropPointId };
          }) } : undefined,
          outboundKordaId: data.outboundKordaId,
          outboundDropPointId: data.outboundDropPointId,
          outboundDate: data.outboundDate,
          outboundPaid: data.outboundPaid ?? false,
          returnKordaId: data.returnKordaId,
          returnDropPointId: data.returnDropPointId,
          returnDate: data.returnDate,
          returnPaid: data.returnPaid ?? false,
          kordaChanged: data.kordaChanged ?? false,
          kordaChangeConfirmed: data.kordaChangeConfirmed ?? false,
          registrarName: data.registrarName,
          registrarPhone: data.registrarPhone,
          notes: data.notes,
        },
        select: registrationSelect,
      });
      logger.info(
        { id: result.id, studentId: data.studentId, eventId: data.eventId },
        "registrationRepository.create success"
      );
      return result as unknown as Registration;
    } catch (error) {
      logger.error({ err: error, data }, "registrationRepository.create failed");
      throw error;
    }
  },

  async update(
    id: string,
    data: RegistrationUpdateData
  ): Promise<Registration> {
    try {
      const result = await prisma.registration.update({
        where: { id },
        data: {
          outboundKordaId: data.outboundKordaId,
          outboundDropPointId: data.outboundDropPointId,
          outboundPaid: data.outboundPaid,
          returnKordaId: data.returnKordaId,
          returnDropPointId: data.returnDropPointId,
          returnPaid: data.returnPaid,
          status: data.status,
          kordaChanged: data.kordaChanged,
          kordaChangeConfirmed: data.kordaChangeConfirmed,
          notes: data.notes,
          cancelledAt: data.cancelledAt,
          cancelReason: data.cancelReason,
          refundAmount: data.refundAmount,
        },
        select: registrationSelect,
      });
      logger.info({ id: result.id }, "registrationRepository.update success");
      return result as unknown as Registration;
    } catch (error) {
      logger.error(
        { err: error, id, data },
        "registrationRepository.update failed"
      );
      throw error;
    }
  },

  async delete(id: string): Promise<Registration> {
    try {
      const result = await prisma.registration.delete({
        where: { id },
        select: registrationSelect,
      });
      logger.info({ id: result.id }, "registrationRepository.delete success");
      return result as unknown as Registration;
    } catch (error) {
      logger.error({ err: error, id }, "registrationRepository.delete failed");
      throw error;
    }
  },
};
