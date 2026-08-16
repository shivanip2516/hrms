<template>
  <div class="fixed inset-0 z-50 flex flex-col bg-black">
    <div class="flex-1 flex items-center justify-center overflow-hidden">
      <video
        v-show="!previewUrl"
        ref="video"
        autoplay
        muted
        playsinline
        class="max-h-full max-w-full object-contain"
      ></video>
      <img v-if="previewUrl" :src="previewUrl" class="max-h-full max-w-full object-contain" />
    </div>

    <p v-if="error" class="px-4 py-3 text-center text-sm text-red-400">{{ error }}</p>

    <div class="flex items-center justify-around gap-4 p-4 pb-8">
      <button class="text-white text-sm" @click="cancel">Cancel</button>

      <button
        v-if="!previewUrl && !error"
        class="h-16 w-16 rounded-full border-4 border-white bg-white/20"
        @click="capture"
      ></button>

      <template v-if="previewUrl">
        <button class="text-white text-sm" @click="retake">Retake</button>
        <button
          class="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
          @click="confirm"
        >
          Use photo
        </button>
      </template>

      <span class="w-10"></span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const emit = defineEmits(['captured', 'cancel'])

const video = ref(null)
const stream = ref(null)
const previewUrl = ref('')
const capturedBlob = ref(null)
const error = ref('')

const MAX_WIDTH = 720
const JPEG_QUALITY = 0.8

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    error.value = 'Camera not available. Open the app over HTTPS or on localhost.'
    return
  }
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    })
    if (video.value) {
      video.value.srcObject = stream.value
      await video.value.play()
    }
  } catch (e) {
    error.value =
      e?.name === 'NotAllowedError'
        ? 'Camera permission denied. Enable it to check in.'
        : 'Unable to start the camera.'
  }
}

function stopCamera() {
  stream.value?.getTracks().forEach((t) => t.stop())
  stream.value = null
}

function capture() {
  const v = video.value
  if (!v || !v.videoWidth) return
  const scale = Math.min(1, MAX_WIDTH / v.videoWidth)
  const w = Math.round(v.videoWidth * scale)
  const h = Math.round(v.videoHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(v, 0, 0, w, h)
  canvas.toBlob(
    (blob) => {
      if (!blob) return
      capturedBlob.value = blob
      previewUrl.value = URL.createObjectURL(blob)
      stopCamera()
    },
    'image/jpeg',
    JPEG_QUALITY,
  )
}

function retake() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  capturedBlob.value = null
  startCamera()
}

function confirm() {
  if (capturedBlob.value) emit('captured', capturedBlob.value)
}

function cancel() {
  stopCamera()
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  emit('cancel')
}

onMounted(startCamera)
onBeforeUnmount(() => {
  stopCamera()
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>
