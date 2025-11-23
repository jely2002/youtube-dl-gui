import { ref } from 'vue';
import { defineStore } from 'pinia';
import { MediaDestinationPayload } from '../../tauri/types/destination';

export type MediaDestination = { path: string; confidence: number };

export const useMediaDestinationStore = defineStore('media-destination', () => {
  const destinations = ref<Record<string, MediaDestination[]>>({});

  const addDestination = (groupId: string, destination: MediaDestination) => {
    destinations.value[groupId] = destinations.value[groupId] ?? [];
    destinations.value[groupId].push(destination);
  };

  const getDestinations = (groupId: string): MediaDestination[] => {
    return destinations.value[groupId] ?? [];
  };

  const getPrimaryDestination = (groupId: string): MediaDestination | undefined => {
    const destinations = getDestinations(groupId);
    destinations.sort((a, b) => b.confidence - a.confidence);
    return destinations[0];
  };

  const deleteDestinations = (groupId: string) => {
    delete destinations.value[groupId];
  };

  function processMediaDestinationPayload(payload: MediaDestinationPayload) {
    addDestination(payload.groupId, payload.destination);
  }

  return {
    destinations,
    addDestination,
    getDestinations,
    getPrimaryDestination,
    deleteDestinations,
    processMediaDestinationPayload,
  };
});
