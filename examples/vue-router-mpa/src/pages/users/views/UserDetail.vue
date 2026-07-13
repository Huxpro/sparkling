<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { SparklingRouter } from 'sparkling-history/vue'
import NavButton from '../../../shared/NavButton.vue'

const route = useRoute()
const router = useRouter() as SparklingRouter

const userId = computed(() => String(route.params.id))
// State handed over from the opener page (rides across heaps in the URL).
const inheritedState = computed(() =>
  JSON.stringify(router.hybridHistory.state ?? {}),
)
</script>

<template>
  <view :style="{ padding: 16, display: 'flex', flexDirection: 'column' }">
    <view :style="{ backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 16 }">
      <text :style="{ fontSize: 22, fontWeight: 'bold', color: '#111' }">
        User #{{ userId }}
      </text>
      <text :style="{ fontSize: 12, color: '#555', marginTop: 8 }">
        params.id = {{ userId }}
      </text>
      <text :style="{ fontSize: 12, color: '#555', marginTop: 4 }">
        query = {{ JSON.stringify(route.query) }}
      </text>
      <text :style="{ fontSize: 12, color: '#555', marginTop: 4 }">
        history.state = {{ inheritedState }}
      </text>
    </view>

    <NavButton
      label="router.back()"
      variant="plain"
      @tap="router.back()"
    />
    <NavButton
      label="push('/users/'+(id+1)) — sibling param route"
      variant="plain"
      @tap="router.push(`/users/${Number(userId) + 1}`)"
    />
    <NavButton label="push('/') — back to main bundle (new container)" @tap="router.push('/')" />
  </view>
</template>
