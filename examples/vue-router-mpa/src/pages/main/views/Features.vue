<script setup lang="ts">
import { useRouter } from 'vue-router'
import NavButton from '../../../shared/NavButton.vue'

const router = useRouter()
</script>

<template>
  <view :style="{ padding: 16, display: 'flex', flexDirection: 'column' }">
    <text :style="{ fontSize: 20, fontWeight: 'bold', color: '#111', marginBottom: 8 }">
      /features — local route
    </text>
    <text :style="{ fontSize: 14, color: '#555', marginBottom: 16, lineHeight: 20 }">
      This navigation stayed inside the container: no native page was opened,
      guards ran locally, and back() below pops the LOCAL history queue.
    </text>
    <NavButton label="router.back() — local queue pop" variant="plain" @tap="router.back()" />
    <NavButton label="push('/users/3') from a nested route" @tap="router.push('/users/3')" />
  </view>
</template>
