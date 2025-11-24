import { BinariesMockData } from '../../utils/mocks/binaryHandlers';
import { UpdaterMockData } from '../../utils/mocks/updateHandlers';
import { StrongholdMockData } from '../../utils/mocks/strongholdHandlers';

export type MockData = {
  binaries?: BinariesMockData;
  updater?: UpdaterMockData;
  stronghold?: StrongholdMockData;
};
