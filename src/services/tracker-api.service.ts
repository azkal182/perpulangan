import { logger } from "@/server/logger";

const TRACK_API_URL = process.env.TRACK_API_URL || "http://localhost:8080";
const ADMIN_API_KEY = process.env.TRACK_ADMIN_API_KEY || "";

interface TrackerApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Array<{
    field: string;
    tag: string;
    message: string;
  }>;
}

interface EventData {
  id: string;
  name: string;
  start_at: string;
  end_at: string;
  created_at: string;
}

interface TrackerData {
  id: string;
  event_id: string;
  label: string;
  kind: string;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

class TrackerApiService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = TRACK_API_URL;
    this.apiKey = ADMIN_API_KEY;
  }

  private get headers() {
    return {
      "Content-Type": "application/json",
      "X-API-Key": this.apiKey,
    };
  }

  /**
   * Create event in tracker API
   */
  async createEvent(params: {
    name: string;
    startAt: Date;
    endAt: Date;
  }): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/events`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          name: params.name,
          start_at: params.startAt.toISOString(),
          end_at: params.endAt.toISOString(),
        }),
      });

      const result: TrackerApiResponse<EventData> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to create event");
      }

      logger.info(
        { eventId: result.data?.id, name: params.name },
        "tracker.event.created",
      );

      return result.data!.id;
    } catch (error) {
      logger.error(
        { error, name: params.name },
        "tracker.event.create.failed",
      );
      throw error;
    }
  }

  /**
   * Create tracker (bus) in tracker API
   */
  async createTracker(params: {
    eventId: string;
    label: string;
    kind?: string;
  }): Promise<string> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/events/${params.eventId}/trackers`,
        {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify({
            label: params.label,
            kind: params.kind || "bus",
          }),
        },
      );

      const result: TrackerApiResponse<TrackerData> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to create tracker");
      }

      logger.info(
        { trackerId: result.data?.id, label: params.label },
        "tracker.tracker.created",
      );

      return result.data!.id;
    } catch (error) {
      logger.error(
        { error, label: params.label },
        "tracker.tracker.create.failed",
      );
      throw error;
    }
  }

  /**
   * Update tracker status (active/inactive)
   */
  async updateTrackerStatus(
    trackerId: string,
    isActive: boolean,
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/trackers/${trackerId}`,
        {
          method: "PATCH",
          headers: this.headers,
          body: JSON.stringify({
            is_active: isActive,
          }),
        },
      );

      const result: TrackerApiResponse<null> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update tracker status");
      }

      logger.info(
        { trackerId, isActive },
        "tracker.tracker.status.updated",
      );
    } catch (error) {
      logger.error(
        { error, trackerId, isActive },
        "tracker.tracker.status.update.failed",
      );
      throw error;
    }
  }
}

export const trackerApi = new TrackerApiService();
