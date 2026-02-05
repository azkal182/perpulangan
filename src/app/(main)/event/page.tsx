import { PlaceholderPage } from "@/components/placeholder-page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Calendar, EllipsisVertical, Users } from "lucide-react";
import CardEvent from "@/features/event/components/CardEvent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function EventPage() {
  return <div>
    <div className="flex flex-col sm:flex-row gap-4 justify-between mb-4">
        <div>
            <h1 className="text-2xl font-bold">Event</h1>
            <p className="text-muted-foreground">Kelola event perpulangan santri</p>
        </div>
        <div className="flex gap-2">
            <Input className="w-full md:w-64" placeholder="Cari event" />
            <Button>Tambah Event</Button>
        </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <CardEvent title="Liburan Ramadhan 2026" date="15 Mar 2026 - 20 Apr 2026" status="Aktif" santri="180/245 lunas" payment="Rp 100.000"/>
        <CardEvent title="Liburan Ramadhan 2026" date="15 Mar 2026 - 20 Apr 2026" status="Aktif" santri="180/245 lunas" payment="Rp 100.000"/>
        <CardEvent title="Liburan Ramadhan 2026" date="15 Mar 2026 - 20 Apr 2026" status="Aktif" santri="180/245 lunas" payment="Rp 100.000"/>
        <CardEvent title="Liburan Ramadhan 2026" date="15 Mar 2026 - 20 Apr 2026" status="Aktif" santri="180/245 lunas" payment="Rp 100.000"/>
        <CardEvent title="Liburan Ramadhan 2026" date="15 Mar 2026 - 20 Apr 2026" status="Aktif" santri="180/245 lunas" payment="Rp 100.000"/>
        <CardEvent title="Liburan Ramadhan 2026" date="15 Mar 2026 - 20 Apr 2026" status="Aktif" santri="180/245 lunas" payment="Rp 100.000"/>
    </div>
  </div>
}
