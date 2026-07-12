<script setup lang="ts">
import { useRouter } from 'vue-router'
import NavButton from '../../../shared/NavButton.vue'

const router = useRouter()
</script>

<template>
  <view :style="{ padding: 16, display: 'flex', flexDirection: 'column' }">
    <text :style="{ fontSize: 14, color: '#555', marginBottom: 16, lineHeight: 20 }">
      vue-router driving Sparkling navigation. Same-bundle routes navigate
      in-place (SPA); routes owned by other bundles open a NEW native
      container (MPA) — different JS heap, this page stays alive underneath.
    </text>

    <text :style="{ fontSize: 12, color: '#999', marginBottom: 4 }">in-container (SPA)</text>
    <NavButton label="push('/features') — local route" variant="plain" @tap="router.push('/features')" />

    <text :style="{ fontSize: 12, color: '#999', marginTop: 12, marginBottom: 4 }">cross-container (MPA)</text>
    <NavButton label="push('/users')" @tap="router.push('/users')" />
    <NavButton
      label="push({ name: 'user-detail', id: 2 }) — named, other bundle"
      @tap="router.push({ name: 'user-detail', params: { id: '2' }, query: { ref: 'home' } })"
    />
    <NavButton
      label="push('/users/1') + history state"
      @tap="router.push({ path: '/users/1', state: { greeting: 'hello from main' } })"
    />
    <NavButton
      label="replace('/settings') — swaps this container"
      @tap="router.replace('/settings')"
    />
  </view>
</template>
