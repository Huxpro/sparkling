<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router'
import type { SparklingRouter } from 'sparkling-history/vue'

const router = useRouter() as SparklingRouter
</script>

<template>
  <view :style="{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f5f5f5' }">
    <text :style="{ fontSize: 18, fontWeight: 'bold', padding: 16, color: '#111', backgroundColor: '#fff' }">
      users bundle · depth {{ router.hybridHistory.depth }}
    </text>
    <text :style="{ fontSize: 12, color: '#888', padding: '4px 16px', backgroundColor: '#fff' }">
      route: {{ router.currentRoute.value.fullPath }}
    </text>
    <RouterView />
  </view>
</template>
