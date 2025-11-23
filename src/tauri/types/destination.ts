import { MediaDestination } from '../../stores/media/destination.ts';

export interface MediaDestinationPayload {
  id: string;
  groupId: string;
  destination: MediaDestination;
}
