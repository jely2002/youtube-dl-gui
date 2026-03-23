import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/app/HomeView.vue';
import MediaView from './views/app/MediaView.vue';
import SubtitleView from './views/app/SubtitleView.vue';
import FullLayout from './layouts/FullLayout.vue';
import AppLayout from './layouts/AppLayout.vue';
import InstallView from './views/full/InstallView.vue';
import TheMediaMetadata from './components/media-view/TheMediaMetadata.vue';
import TheMediaLogs from './components/media-view/TheMediaLogs.vue';
import LocationView from './views/app/LocationView.vue';
import SettingsView from './views/app/SettingsView.vue';
import AuthenticationView from './views/app/AuthenticationView.vue';
import MediaPreferencesView from './views/app/MediaPreferencesView.vue';
import TheDownloadPreferences from './components/media-view/TheDownloadPreferences.vue';
import TheNetworkPreferences from './components/media-view/TheNetworkPreferences.vue';
import TheOutputPreferences from './components/media-view/TheOutputPreferences.vue';

const routes = [
  {
    path: '/install',
    name: 'install',
    component: FullLayout,
    children: [
      {
        path: '',
        name: 'install.index',
        component: InstallView,
        meta: { index: 0 },
      },
    ],
  },
  {
    path: '/',
    name: 'app',
    component: AppLayout,
    children: [
      {
        path: '',
        name: 'home',
        component: HomeView,
        meta: { index: 0 },
      },
      {
        path: 'settings',
        name: 'settings',
        component: SettingsView,
        meta: { index: 1 },
      },
      {
        path: 'location',
        name: 'location',
        component: LocationView,
        meta: { index: 1 },
      },
      {
        path: 'authentication',
        name: 'authentication',
        component: AuthenticationView,
        meta: { index: 1 },
      },
      {
        path: 'subtitles',
        name: 'subtitles',
        component: SubtitleView,
        meta: { index: 1 },
      },
      {
        path: 'group/:groupId',
        name: 'group',
        component: MediaView,
        props: true,
        meta: { index: 1, requiresGroup: true },
        children: [
          {
            path: '',
            name: 'group.metadata',
            component: TheMediaMetadata,
            props: true,
            meta: { index: 0 },
          },
          {
            path: 'logs',
            name: 'group.logs',
            component: TheMediaLogs,
            props: true,
            meta: { index: 1 },
          },
        ],
      },
      {
        path: 'preferences/:groupId',
        name: 'preferences',
        component: MediaPreferencesView,
        props: true,
        meta: { index: 1, requiresGroup: true },
        children: [
          {
            path: '',
            name: 'preferences.quality',
            component: TheDownloadPreferences,
            props: true,
            meta: { index: 0 },
          },
          {
            path: 'network',
            name: 'preferences.network',
            component: TheNetworkPreferences,
            props: true,
            meta: { index: 1 },
          },
          {
            path: 'output',
            name: 'preferences.output',
            component: TheOutputPreferences,
            props: true,
            meta: { index: 2 },
          },
        ],
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
