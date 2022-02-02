const fs = require('fs').promises;
const os = require('os');
const { globalShortcut, clipboard } = require('electron');

jest.mock('electron', () => ({
  clipboard: {
    readText: jest.fn()
  },
  globalShortcut: {
    unregisterAll: jest.fn(),
    isRegistered: jest.fn(),
    register: jest.fn(),
  }
}));

const Settings = require('../modules/persistence/Settings');
const env = {version: '2.0.0-test1', app: {getPath: jest.fn().mockReturnValue('test/path')}};
const defaultSettingsInstance = new Settings({settings: 'tests/test-settings.json'}, env, 'none', 'none', 'test/path', '', '', true, false, true, 'spoof', false, false, true, '%(title).200s-(%(height)sp%(fps).0d).%(ext)s', '%(title).200s-(%(height)sp%(fps).0d).%(ext)s', 'click', '49', 8, true, 'video', true, 'C:\\Users\\user\\cookies.txt', false, '', '', 'https://sponsor.ajay.app', true, false, false, false, true, 'dark');
const defaultSettings = {
  outputFormat: 'none',
  audioOutputFormat: 'none',
  downloadPath: 'test/path',
  proxy: '',
  rateLimit: '',
  autoFillClipboard: true,
  noPlaylist: false,
  globalShortcut: true,
  userAgent: 'spoof',
  validateCertificate: false,
  enableEncoding: false,
  taskList: true,
  nameFormat: '%(title).200s-(%(height)sp%(fps).0d).%(ext)s',
  nameFormatMode: '%(title).200s-(%(height)sp%(fps).0d).%(ext)s',
  sizeMode: 'click',
  splitMode: '49',
  maxConcurrent: 8,
  defaultConcurrent: 8,
  updateBinary: true,
  downloadType: 'video',
  updateApplication: true,
  statSend: false,
  sponsorblockMark: '',
  sponsorblockRemove: '',
  sponsorblockApi: 'https://sponsor.ajay.app',
  downloadMetadata: true,
  downloadJsonMetadata: false,
  downloadThumbnail: false,
  keepUnmerged: false,
  calculateTotalSize: true,
  theme: 'dark',
  version: '2.0.0-test1',
};

describe('Load settings from file', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.writeFile = jest.fn().mockResolvedValue('');
    console.log = jest.fn().mockImplementation(() => {
    });
  });
  it('reads the specified file', () => {
    const readFileSpy = jest.spyOn(fs, 'readFile');
    return Settings.loadFromFile({settings: 'tests/test-settings.json'}, env).then((data) => {
      expect(readFileSpy).toBeCalledTimes(1);
    });
  });
  it('returns a settings instance', () => {
    return Settings.loadFromFile({settings: 'tests/test-settings.json'}, env).then((data) => {
      expect(data).toBeInstanceOf(Settings);
    });
  });
  it('returns a settings instance with the right values', () => {
    return Settings.loadFromFile({settings: 'tests/test-settings.json'}, env).then((data) => {
      expect(data).toMatchObject(defaultSettingsInstance);
    });
  });
});


describe('Create new settings file on error', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    os.cpus = jest.fn().mockImplementation(() => {
      return new Array(16);
    });
    fs.writeFile = jest.fn().mockResolvedValue('');
    console.log = jest.fn().mockImplementation(() => {
    });
  });
  it('uses the path defined in paths', () => {
    return Settings.loadFromFile({settings: 'tests/non-existent-file.json'}, env).then(() => {
      expect(fs.writeFile.mock.calls[0]).toContain('tests/non-existent-file.json');
    });
  });
  it('writes the new settings file', () => {
    return Settings.loadFromFile({settings: 'tests/non-existent-file.json'}, env).then(() => {
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
    });
  });
  it('writes the given settings', () => {
    return Settings.loadFromFile({settings: 'tests/non-existent-file.json'}, env).then(() => {
      expect(fs.writeFile.mock.calls[0]).toContainEqual(JSON.stringify(defaultSettings));
    });
  });
});

describe('Update settings to file', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.writeFile = jest.fn().mockResolvedValue('');
    env.appUpdater = {setUpdateSetting: jest.fn()};
    env.changeMaxConcurrent = jest.fn();
    console.log = jest.fn().mockImplementation(() => {
    });
  });
  it('writes the updated file', () => {
    return Settings.loadFromFile({settings: 'tests/test-settings.json'}, env).then(data => {
      delete data.cookiePath;
      data.update(JSON.parse(JSON.stringify(defaultSettings)));
      expect(fs.writeFile).toBeCalledTimes(1);
      expect(fs.writeFile.mock.calls[0]).toContainEqual(JSON.stringify(defaultSettings));
    });
  });
  it('updates the maxConcurrent value when it changes', () => {
    const changedDefaultSettings = JSON.parse(JSON.stringify(defaultSettings));
    changedDefaultSettings.maxConcurrent = 4;

    return Settings.loadFromFile({settings: 'tests/test-settings.json'}, env).then(data => {
      data.update(changedDefaultSettings);
      expect(env.changeMaxConcurrent).toBeCalledTimes(1);
    });
  });
});

