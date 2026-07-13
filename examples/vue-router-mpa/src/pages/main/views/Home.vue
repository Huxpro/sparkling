<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import NavButton from '../../../shared/NavButton.vue'

const router = useRouter()

// Cross-container navigation calls Sparkling's native `router.open`. In a real
// Sparkling container (device, or the web-shell harness) this opens a new page,
// so you never see the result here. In an embedded preview with no native host
// (the go-web `<Go>` web preview), `router.open` has nowhere to go, and we
// surface that instead of failing silently.
const navStatus = ref('')

async function crossNav(to: RouteLocationRaw, mode: 'push' | 'replace' = 'push') {
  navStatus.value = ''
  try {
    await (mode === 'replace' ? router.replace(to) : router.push(to))
  } catch (err) {
    navStatus.value = `native navigation unavailable here — open on device: ${
      err instanceof Error ? err.message : String(err)
    }`
  }
}
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
    <NavButton label="push('/users')" @tap="crossNav('/users')" />
    <NavButton
      label="push({ name: 'user-detail', id: 2 }) — named, other bundle"
      @tap="crossNav({ name: 'user-detail', params: { id: '2' }, query: { ref: 'home' } })"
    />
    <NavButton
      label="push('/users/1') + history state"
      @tap="crossNav({ path: '/users/1', state: { greeting: 'hello from main' } })"
    />
    <NavButton
      label="replace('/settings') — swaps this container"
      @tap="crossNav('/settings', 'replace')"
    />

    <text
      v-if="navStatus"
      :style="{ fontSize: 12, color: '#e5533d', marginTop: 12, lineHeight: 18 }"
    >
      {{ navStatus }}
    </text>
  </view>
</template>
