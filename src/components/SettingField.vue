<script setup lang="ts">
import AppSelect from '@/components/AppSelect.vue'
import AppSwitch from '@/components/AppSwitch.vue'

export interface SettingFieldData {
  key: string
  label: string
  /** Shorter label for use under a heading that already names the provider. */
  short_label?: string
  section?: string
  type: 'string' | 'secret' | 'int' | 'float' | 'bool' | 'select'
  description?: string
  options?: Record<string, string>
  min?: number
  max?: number
  step?: number
  value?: string | number | boolean | null
  default?: string | number | boolean | null
  overridden: boolean
  is_set?: boolean
  masked?: string | null
  source?: 'panel' | 'env' | null
}

const props = defineProps<{ field: SettingFieldData }>()
const model = defineModel<unknown>()
defineEmits<{ reset: [field: SettingFieldData] }>()

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(kosong)'
  if (typeof value === 'boolean') return value ? 'Aktif' : 'Nonaktif'
  return String(value)
}

const label = props.field.short_label ?? props.field.label
</script>

<template>
  <label class="block min-w-0">
    <span class="mb-1 flex items-center justify-between gap-2 text-xs">
      <span class="font-medium text-text">{{ label }}</span>
      <span v-if="field.overridden" class="flex shrink-0 items-center gap-2">
        <span class="rounded bg-brand/15 px-1.5 text-[10px] text-brand">diubah di panel</span>
        <button type="button" class="text-[10px] text-muted underline hover:text-text" @click="$emit('reset', field)">reset ke .env</button>
      </span>
    </span>

    <template v-if="field.type === 'secret'">
      <input v-model="model as string" type="password" class="num w-full" autocomplete="new-password" :placeholder="field.is_set ? `Terisi ${field.masked} — kosongkan jika tidak diganti` : 'Belum diisi'" />
      <span class="mt-1 block text-[11px]" :class="field.is_set ? 'text-up' : 'text-muted'">
        {{ field.is_set ? `Terisi (${field.source === 'panel' ? 'dari panel' : 'dari .env'})` : 'Kosong' }}
      </span>
    </template>
    <AppSelect
      v-else-if="field.type === 'select'"
      v-model="model as string"
      class="w-full"
      :options="Object.entries(field.options ?? {}).map(([value, text]) => ({ value, label: text }))"
    />
    <span v-else-if="field.type === 'bool'" class="flex items-center gap-2 py-2">
      <AppSwitch v-model="model as boolean" :label="field.label" />
      <span class="text-sm">{{ model ? 'Aktif' : 'Nonaktif' }}</span>
    </span>
    <input
      v-else-if="field.type === 'int' || field.type === 'float'"
      v-model.number="model"
      type="number"
      class="num w-full"
      :min="field.min"
      :max="field.max"
      :step="field.step ?? (field.type === 'int' ? 1 : 'any')"
    />
    <input v-else v-model="model as string" class="w-full" />

    <span v-if="field.description" class="mt-1 block text-[11px] text-muted">{{ field.description }}</span>
    <span v-if="field.overridden && field.type !== 'secret'" class="mt-0.5 block text-[11px] text-muted">Nilai .env: {{ display(field.default) }}</span>
  </label>
</template>
