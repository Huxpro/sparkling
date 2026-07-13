<script setup lang="ts">
import { useRouter } from 'vue-router'
import NavButton from '../../../shared/NavButton.vue'

const router = useRouter()
</script>

<template>
  <view :style="{ padding: 16, display: 'flex', flexDirection: 'column' }">
    <text :style="{ fontSize: 14, color: '#555', marginBottom: 16, lineHeight: 20 }">
      This page declares container params in its routes.json
      (title=Settings), which the manifest codec appends to every scheme
      that opens it.
    </text>
    <NavButton label="router.back() — closes this container" variant="plain" @tap="router.back()" />
    <NavButton label="replace('/') — swap for the main container" @tap="router.replace('/')" />
    <NavButton label="push('/users/1')" @tap="router.push('/users/1')" />
  </view>
</template>
