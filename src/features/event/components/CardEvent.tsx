import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar, Users } from "lucide-react";

interface CardEventProps {
  title: string;
  date: string;
  status: string;
  statusVariant?: "default" | "secondary" | "outline" | "destructive";
  santri: string;
  actions?: React.ReactNode;
}

const CardEvent = ({
  title,
  date,
  status,
  statusVariant = "secondary",
  santri,
  actions,
}: CardEventProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar />
            <Badge variant={statusVariant}>{status}</Badge>
          </div>
          <div>{actions}</div>
        </div>

        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{date}</p>
        </div>
        <Separator />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users size={16} />
              <p className="text-muted-foreground">Pendaftar</p>
            </div>
            <p className="text-muted-foreground">{santri} Pendaftar</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CardEvent;
