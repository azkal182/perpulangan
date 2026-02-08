export type EventStatus = "DRAFT" | "ACTIVE" | "COMPLETED";

export type EventItem = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: EventStatus;
  createdAt?: Date;
  updatedAt?: Date;
};
