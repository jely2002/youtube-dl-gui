import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/app/HomeView.vue';
import MediaView from './views/app/MediaView.vue';
import SubtitleView from './views/app/SubtitleView.vue';
import FullLayout from './layouts/FullLayout.vue';
import AppLayout from './layouts/AppLayout.vue';
import InstallView from './views/full/InstallView.vue';
import TheMediaMetadata from './components/media-view/TheMediaMetadata.vue';
import TheMediaLogs from './components/media-view/TheMediaLogs.vue';

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
        component: () => import('./views/app/SettingsView.vue'),
        meta: { index: 1 },
      },
      {
        path: 'location',
        name: 'location',
        component: () => import('./views/app/LocationView.vue'),
        meta: { index: 1 },
      },
      {
        path: 'authentication',
        name: 'authentication',
        component: () => import('./views/app/AuthenticationView.vue'),
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
        meta: { index: 1 },
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
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
