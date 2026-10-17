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
