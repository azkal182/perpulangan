export type EventStatus = "DRAFT" | "ACTIVE" | "COMPLETED";

export type EventItem = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: EventStatus;
  trackerEventId?: string | null;
  trackerSyncAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  _count: {
    registrations: number;
  };
};

export type EventWithPayment = EventItem & {
  payment: {
    totalDue: number;
    totalPaid: number;
    outboundDue: number;
    outboundPaid: number;
    returnDue: number;
    returnPaid: number;
  };
};
