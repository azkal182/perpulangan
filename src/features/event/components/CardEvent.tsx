import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Calendar, EllipsisVertical, Users } from 'lucide-react'


interface CardEventProps {
    title: string;
    date: string;
    status: string;
    santri: string;
    payment: string;
}

const CardEvent = ({title, date, status, santri, payment}: CardEventProps) => {
  return (
    <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Calendar/>
                        <Badge variant="secondary">{status}</Badge>
                    </div>
                    <div>
                        <EllipsisVertical/>
                    </div>
                </div>

                <div>
                    <h2 className="font-semibold">{title}</h2>
                    <p className="text-sm text-muted-foreground">{date}</p>
                </div>
            <Separator/>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Users size={16}/>
                        <p className=" text-muted-foreground">Santri</p>
                    </div>
                    <p className=" text-muted-foreground">{santri} Santri</p>
                </div>
                <Progress value={33} />
                <div className="flex items-center justify-between">
                    <p className="text-muted-foreground">Pembayaran</p>
                    <p className="text-muted-foreground">{payment}</p>
                </div>
                </div>
            </CardContent>
        </Card>
  )
}

export default CardEvent
