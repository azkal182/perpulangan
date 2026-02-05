"use client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SantriTableCard } from "@/features/santri/components/SantriTableCard";
import { getStudents } from "@/features/santri/services/students.repository";
import { Download, Filter, Info, Search, UserPlus, XIcon } from "lucide-react";

const SantriPage = () => {
  const fetchData = async () => {
    try {
      const data = await getStudents();
      console.log(data);
    } catch {
      alert("Error fetching data");
    }
  };

  return (
    <div className="w-full space-y-4">
      <Alert className="flex items-center justify-between pr-2 [&>svg+div]:translate-y-0 border-none bg-emerald-600/10 text-emerald-500 dark:bg-emerald-600/15">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-4" />
          <div className="flex-col justify-center">
            <AlertTitle>Perpulangan Aktif</AlertTitle>
            <AlertDescription>Liburan Ramadhan 2026</AlertDescription>
          </div>
        </div>
        <Button className="pl-0!" size="icon" variant="ghost">
          <XIcon className="h-5 w-5" />
        </Button>
      </Alert>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* LEFT */}
        <div className="flex w-full flex-col gap-3 md:flex-1 md:flex-row md:items-center md:gap-3">
          {/* Search */}
          <div className="relative w-full md:max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
            <Input
              className="pl-9"
              placeholder="Cari nama atau NIS..."
              aria-label="Cari nama atau NIS"
            />
          </div>

          {/* Controls row: Select + Filter */}
          <div className="flex w-full gap-3 md:w-auto md:items-center">
            <Select defaultValue="all">
              <SelectTrigger className="w-full md:w-[170px]">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Nonaktif</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              className="shrink-0"
              size="icon"
              aria-label="Filter"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end md:w-auto">
          <Button
            onClick={fetchData}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>

          <Button className="w-full sm:w-auto">
            <UserPlus className="mr-2 h-4 w-4" />
            Tambah Siswa
          </Button>
        </div>
      </div>

      <SantriTableCard />
    </div>
  );
};

export default SantriPage;
