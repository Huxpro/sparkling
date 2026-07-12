<script setup lang="ts">
defineProps<{
  label: string
  variant?: 'primary' | 'plain'
}>()

const emit = defineEmits<{ tap: [] }>()
</script>

<template>
  <text
    @tap="emit('tap')"
    :style="{
      fontSize: 14,
      padding: '10px 14px',
      marginBottom: 8,
      borderRadius: 8,
      alignSelf: 'flex-start',
      color: variant === 'plain' ? '#1a73e8' : '#fff',
      backgroundColor: variant === 'plain' ? '#e8f0fe' : '#1a73e8',
    }"
  >
    {{ label }}
  </text>
</template>
