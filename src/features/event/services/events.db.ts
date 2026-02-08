import { eventRepository } from "../repositories/event.repository";

export async function getEvents() {
  return eventRepository.findMany();
}
