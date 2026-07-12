<script setup lang="ts">
import { useRouter } from 'vue-router'
import NavButton from '../../../shared/NavButton.vue'

const router = useRouter()

const users = [
  { id: '1', name: 'Alice', role: 'Engineer' },
  { id: '2', name: 'Bob', role: 'Designer' },
  { id: '3', name: 'Charlie', role: 'PM' },
]
</script>

<template>
  <view :style="{ padding: 16, display: 'flex', flexDirection: 'column' }">
    <text :style="{ fontSize: 14, color: '#555', marginBottom: 12, lineHeight: 20 }">
      /users and /users/:id are BOTH owned by this bundle — tapping a user is
      an in-container SPA navigation with a dynamic param.
    </text>

    <view
      v-for="user in users"
      :key="user.id"
      @tap="router.push(`/users/${user.id}`)"
      :style="{ backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8, display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }"
    >
      <text :style="{ fontSize: 15, color: '#111' }">{{ user.name }}</text>
      <text :style="{ fontSize: 13, color: '#1a73e8' }">{{ user.role }} →</text>
    </view>

    <text :style="{ fontSize: 12, color: '#999', marginTop: 12, marginBottom: 4 }">container boundary</text>
    <NavButton label="router.back() — closes this container" variant="plain" @tap="router.back()" />
    <NavButton label="push('/settings') — another container on top" @tap="router.push('/settings')" />
  </view>
</template>
