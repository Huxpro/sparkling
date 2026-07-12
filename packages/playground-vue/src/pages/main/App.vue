<script setup lang="ts">
import { ref } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import type { SparklingRouter } from 'sparkling-history/vue'

const router = useRouter() as SparklingRouter

// pageshow-like hook: fires when a page stacked on top of us is closed.
const restoreCount = ref(0)
router.hybridHistory.onRestore(({ visible }) => {
  if (visible) restoreCount.value++
})
</script>

<template>
  <view :style="{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f5f5f5' }">
    <text :style="{ fontSize: 18, fontWeight: 'bold', padding: 16, color: '#111', backgroundColor: '#fff' }">
      main bundle · depth {{ router.hybridHistory.depth }}
    </text>
    <text :style="{ fontSize: 12, color: '#888', padding: '4px 16px', backgroundColor: '#fff' }">
      route: {{ router.currentRoute.value.fullPath }} · restored ×{{ restoreCount }}
    </text>
    <RouterView />
  </view>
</template>
