<template>
	<div class="flex flex-col bg-white rounded w-full py-6 px-4 border-none">
		<h2 class="text-lg font-bold text-gray-900">
			{{ __("Hey, {0} 👋", [employee?.data?.first_name]) }}
		</h2>

		<template v-if="settings.data?.allow_employee_checkin_from_mobile_app">
			<div class="font-medium text-sm text-gray-500 mt-1.5" v-if="attendanceStatus?.today_checkin_time && !attendanceStatus?.today_checkout_time">
				{{ __("Checked in at {0}", [formatTimestamp(attendanceStatus.today_checkin_time)]) }}
			</div>
			<div class="font-medium text-sm text-gray-500 mt-1.5" v-else-if="attendanceStatus?.attendance_completed">
				{{ __("Attendance completed for today") }}
			</div>
			<div class="font-medium text-sm text-gray-500 mt-1.5" v-else-if="lastLog">
				<span>{{ __("Last {0} was at {1}", [__(lastLogType), formatTimestamp(lastLog.time)]) }}</span>
				<span class="whitespace-pre"> &middot; </span>
				<router-link :to="{ name: 'EmployeeCheckinListView' }" v-slot="{ navigate }">
					<span @click="navigate" class="underline">View List</span>
				</router-link>
			</div>
			<div class="font-medium text-sm text-gray-500 mt-1.5" v-else>
				{{ dayjs().format("ddd, D MMMM, YYYY") }}
			</div>

			<div v-if="attendanceStatus?.blocked_by_checkout_date" class="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
				<div class="font-semibold">
					{{ __("Missed Check-out for {0}", [formatDate(attendanceStatus.blocked_by_checkout_date)]) }}
				</div>
				<div v-if="attendanceStatus.pending_missed_checkout" class="mt-1">
					{{ __("Pending Approval") }}
				</div>
				<Button
					v-else-if="attendanceStatus.can_request_checkout"
					class="mt-3 w-full"
					variant="subtle"
					@click="openMissedCheckoutDialog"
				>
					{{ __("Request Missed Check-out") }}
				</Button>
			</div>

			<Button
				v-if="currentAction"
				class="mt-4 mb-1 drop-shadow-sm py-5 text-base"
				id="open-checkin-modal"
				:loading="checkins.list.loading || attendanceStatusLoading"
				@click="handleEmployeeCheckin"
			>
				<template #prefix>
					<FeatherIcon
						:name="currentAction.action === 'IN' ? 'arrow-right-circle' : 'arrow-left-circle'"
						class="w-4"
					/>
				</template>
				{{ currentAction.label }}
			</Button>
		</template>

		<div v-else class="font-medium text-sm text-gray-500 mt-1.5">
			{{ dayjs().format("ddd, D MMMM, YYYY") }}
		</div>
	</div>

	<SelfieCapture
		v-if="showSelfie"
		@captured="handleSelfieCapture"
		@cancel="handleSelfieCancel"
	/>

	<ion-modal
		v-if="settings.data?.allow_employee_checkin_from_mobile_app"
		ref="modal"
		trigger="open-checkin-modal"
		:initial-breakpoint="1"
		:breakpoints="[0, 1]"
	>
		<div class="h-120 w-full flex flex-col items-center justify-center gap-5 p-4 mb-5">
			<div class="flex flex-col gap-1.5 mt-2 items-center justify-center">
				<div class="font-bold text-xl">
					{{ dayjs(checkinTimestamp).format("hh:mm:ss a") }}
				</div>
				<div class="font-medium text-gray-500 text-sm">
					{{ dayjs().format("D MMM, YYYY") }}
				</div>
			</div>

			<template v-if="settings.data?.allow_geolocation_tracking">
				<span v-if="locationStatus" class="font-medium text-gray-500 text-sm">
					{{ locationStatus }}
				</span>

				<div class="rounded border-4 translate-z-0 block overflow-hidden w-full h-170">
					<iframe
						width="100%"
						height="170"
						frameborder="0"
						scrolling="no"
						marginheight="0"
						marginwidth="0"
						style="border: 0"
						:src="`https://maps.google.com/maps?q=${latitude},${longitude}&hl=en&z=15&amp;output=embed`"
					>
					</iframe>
				</div>
			</template>

			<Button :loading="checkins.insert.loading || showSelfie" variant="solid" class="w-full py-5 text-sm disabled:bg-gray-700" @click="submitLog(currentAction?.action)">
				{{ __("Confirm {0}", [currentAction?.label]) }}
			</Button>
		</div>
	</ion-modal>

	<ion-modal :is-open="showMissedCheckoutDialog" @didDismiss="closeMissedCheckoutDialog">
		<div class="h-full w-full flex flex-col gap-4 bg-white p-5">
			<div>
				<h2 class="text-xl font-bold text-gray-900">{{ __("Request Missed Check-out") }}</h2>
				<p class="mt-1 text-sm text-gray-500">
					{{ __("Missed Check-out for {0}", [formatDate(missedCheckoutRequest.attendance_date)]) }}
				</p>
			</div>
			<label class="text-sm font-medium">
				{{ __("Attendance Date") }}
				<input v-model="missedCheckoutRequest.attendance_date" type="date" class="mt-1 w-full rounded border px-3 py-2 bg-gray-100" disabled />
			</label>
			<label class="text-sm font-medium">
				{{ __("Requested Check-out Time") }}
				<input v-model="missedCheckoutRequest.requested_time" type="time" class="mt-1 w-full rounded border px-3 py-2" required />
			</label>
			<label class="text-sm font-medium">
				{{ __("Reason") }}
				<textarea v-model="missedCheckoutRequest.reason" class="mt-1 w-full rounded border px-3 py-2" rows="4" required />
			</label>
			<div v-if="missedCheckoutLocationStatus" class="text-sm text-gray-500">
				{{ missedCheckoutLocationStatus }}
			</div>
			<div class="mt-auto flex gap-2">
				<Button class="w-full" variant="subtle" @click="closeMissedCheckoutDialog">{{ __("Cancel") }}</Button>
				<Button class="w-full" variant="solid" :loading="missedCheckoutSubmitting" @click="submitMissedCheckoutRequest">
					{{ __("Submit") }}
				</Button>
			</div>
		</div>
	</ion-modal>
</template>

<script setup>
import { createListResource, toast, FeatherIcon } from "frappe-ui"
import { computed, inject, ref, onMounted, onBeforeUnmount } from "vue"
import { IonModal, modalController } from "@ionic/vue"

import { formatTimestamp } from "@/utils/formatters"
import { settings } from "@/data/settings"
import SelfieCapture from "@/components/SelfieCapture.vue"

const DOCTYPE = "Employee Checkin"

const socket = inject("$socket")
const employee = inject("$employee")
const dayjs = inject("$dayjs")
const __ = inject("$translate")
const checkinTimestamp = ref(null)
const latitude = ref(0)
const longitude = ref(0)
const locationStatus = ref("")
const showSelfie = ref(false)
const pendingLogType = ref(null)
const pendingSelfieFile = ref(null)
const attendanceStatus = ref(null)
const attendanceStatusLoading = ref(false)
const showMissedCheckoutDialog = ref(false)
const missedCheckoutSubmitting = ref(false)
const missedCheckoutRequest = ref(emptyMissedCheckoutRequest())
const missedCheckoutLocationStatus = ref("")

const checkins = createListResource({
	doctype: DOCTYPE,
	fields: ["name", "employee", "employee_name", "log_type", "time", "device_id"],
	filters: {
		employee: employee.data.name,
	},
	orderBy: "time desc",
})
checkins.reload()

const lastLog = computed(() => {
	if (checkins.list.loading || !checkins.data) return {}
	return checkins.data[0]
})

const lastLogType = computed(() => {
	return lastLog?.value?.log_type === "IN" ? "check-in" : "check-out"
})

const nextAction = computed(() => {
	return lastLog?.value?.log_type === "IN"
		? { action: "OUT", label: __("Check Out") }
		: { action: "IN", label: __("Check In") }
})

const currentAction = computed(() => {
	if (attendanceStatus.value?.can_checkout) {
		return { action: "OUT", label: __("Check Out") }
	}
	if (attendanceStatus.value?.can_checkin) {
		return { action: "IN", label: __("Check In") }
	}
	if (!attendanceStatus.value) {
		return nextAction.value
	}
	return null
})

function handleLocationSuccess(position) {
	latitude.value = position.coords.latitude
	longitude.value = position.coords.longitude

	locationStatus.value = [
		__("Latitude: {0}°", [Number(latitude.value).toFixed(5)]),
		__("Longitude: {0}°", [Number(longitude.value).toFixed(5)]),
	].join(", ")
}

function handleLocationError(error) {
	locationStatus.value = "Unable to retrieve your location"
	if (error) locationStatus.value += `: ERROR(${error.code}): ${error.message}`
}

const fetchLocation = () => {
	if (!navigator.geolocation) {
		locationStatus.value = __("Geolocation is not supported by your current browser")
	} else {
		locationStatus.value = __("Locating...")
		navigator.geolocation.getCurrentPosition(handleLocationSuccess, handleLocationError)
	}
}

const handleEmployeeCheckin = () => {
	if (!currentAction.value) return
	checkinTimestamp.value = dayjs().format("YYYY-MM-DD HH:mm:ss")

	if (settings.data?.allow_geolocation_tracking) {
		fetchLocation()
	}
}

async function uploadSelfie(blob) {
	const fd = new FormData()
	fd.append('file', blob, `checkin-selfie-${Date.now()}.jpg`)
	fd.append('is_private', 1)
	const res = await fetch('/api/method/upload_file', {
		method: 'POST',
		headers: { 'X-Frappe-CSRF-Token': window.csrf_token },
		credentials: 'same-origin',
		body: fd,
	})
	if (!res.ok) {
		const errData = await res.json()
		throw new Error(errData.message || 'Selfie upload failed')
	}
	const data = await res.json()
	return data.message.file_url
}

async function handleSelfieCapture(blob) {
	let logType = pendingLogType.value
	let fileUrl = null
	
	try {
		// Upload selfie first
		fileUrl = await uploadSelfie(blob)
		pendingSelfieFile.value = fileUrl
		
		// If logType is still null, something went wrong
		if (!logType) {
			throw new Error("Check-in type (IN/OUT) was not set")
		}
		
		// Now submit with selfie
		await submitLogWithSelfie(logType, fileUrl)
	} catch (error) {
		const actionLabel = logType === "IN" ? __("Check-in") : __("Check-out")
		toast({
			title: __("Error"),
			text: error.message || __("Failed to complete check-in"),
			icon: "alert-circle",
			position: "bottom-center",
			iconClasses: "text-red-500",
		})
		console.error("Selfie capture error:", error)
	} finally {
		showSelfie.value = false
		pendingLogType.value = null
		pendingSelfieFile.value = null
	}
}

function handleSelfieCancel() {
	showSelfie.value = false
	pendingLogType.value = null
	pendingSelfieFile.value = null
	// Dismiss any open modals
	try {
		modalController.dismiss()
	} catch (e) {
		// Modal may already be closed
	}
}

async function submitLogWithSelfie(logType, fileUrl) {
	const actionLabel = logType === "IN" ? __("Check-in") : __("Check-out")

	checkins.insert.submit(
		{
			employee: employee.data.name,
			log_type: logType,
			time: checkinTimestamp.value,
			latitude: latitude.value,
			longitude: longitude.value,
			custom_selfie: fileUrl,
			custom_checkin_source: "PWA Selfie App",
		},
		{
			onSuccess() {
				// Modal was already dismissed when selfie capture started
				toast({
					title: __("Success"),
					text: __("{0} successful!", [actionLabel]),
					icon: "check-circle",
					position: "bottom-center",
					iconClasses: "text-green-500",
				})
				checkins.reload()
				loadAttendanceStatus()
			},
			onError(error) {
				let messages = error.messages || []

				for (const message of messages) {
					toast({
						title: __("Error"),
						text: message || __("{0} failed!", [actionLabel]),
						icon: "alert-circle",
						position: "bottom-center",
						iconClasses: "text-red-500",
					})
				}
			},
		}
	)
}

const submitLog = (logType) => {
	if (!logType) return
	// Store the log type and show selfie capture overlay
	pendingLogType.value = logType
	showSelfie.value = true
	// Dismiss the confirmation modal while selfie is being captured
	modalController.dismiss()
}

async function attendanceApi(method, args = {}) {
	const response = await fetch(`/api/method/dekure_custom.api.${method}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Frappe-CSRF-Token": window.csrf_token,
		},
		credentials: "same-origin",
		body: JSON.stringify(args),
	})
	const payload = await response.json()
	if (!response.ok || payload.exc) {
		throw new Error(getServerError(payload))
	}
	return payload.message
}

async function loadAttendanceStatus() {
	attendanceStatusLoading.value = true
	try {
		attendanceStatus.value = await attendanceApi("get_missed_punch_status")
	} catch (error) {
		toast({
			title: __("Error"),
			text: error.message,
			icon: "alert-circle",
			position: "bottom-center",
			iconClasses: "text-red-500",
		})
	} finally {
		attendanceStatusLoading.value = false
	}
}

function openMissedCheckoutDialog() {
	missedCheckoutRequest.value = {
		attendance_date: attendanceStatus.value?.missed_checkout_date || "",
		requested_time: formatTimeForInput(attendanceStatus.value?.default_checkout_time),
		reason: "",
	}
	showMissedCheckoutDialog.value = true
}

function closeMissedCheckoutDialog() {
	showMissedCheckoutDialog.value = false
	missedCheckoutSubmitting.value = false
	missedCheckoutLocationStatus.value = ""
}

async function submitMissedCheckoutRequest() {
	if (!missedCheckoutRequest.value.requested_time || !missedCheckoutRequest.value.reason?.trim()) {
		toast({
			title: __("Error"),
			text: __("Requested Check-out Time and Reason are required."),
			icon: "alert-circle",
			position: "bottom-center",
			iconClasses: "text-red-500",
		})
		return
	}
	missedCheckoutSubmitting.value = true
	missedCheckoutLocationStatus.value = __("Getting your current location...")
	try {
		const location = await getMissedCheckoutLocation()
		await attendanceApi("create_missed_punch_request", {
			request_type: "Missed Check-out",
			...missedCheckoutRequest.value,
			latitude: location.latitude,
			longitude: location.longitude,
		})
		toast({
			title: __("Success"),
			text: __("Missed Check-out request submitted for approval."),
			icon: "check-circle",
			position: "bottom-center",
			iconClasses: "text-green-500",
		})
		closeMissedCheckoutDialog()
		await loadAttendanceStatus()
	} catch (error) {
		missedCheckoutLocationStatus.value = error.message
		toast({
			title: __("Error"),
			text: error.message,
			icon: "alert-circle",
			position: "bottom-center",
			iconClasses: "text-red-500",
		})
	} finally {
		missedCheckoutSubmitting.value = false
	}
}

function getMissedCheckoutLocation() {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error(__("Unable to get your current location. Please allow location access and try again.")))
			return
		}

		navigator.geolocation.getCurrentPosition(
			(position) => {
				const latitude = position.coords.latitude
				const longitude = position.coords.longitude
				if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) {
					reject(new Error(__("Unable to get your current location. Please allow location access and try again.")))
					return
				}
				resolve({ latitude, longitude })
			},
			() => reject(new Error(__("Unable to get your current location. Please allow location access and try again."))),
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
		)
	})
}

function emptyMissedCheckoutRequest() {
	return { attendance_date: "", requested_time: "", reason: "" }
}

function formatDate(value) {
	return value ? dayjs(value).format("DD-MMM-YYYY") : "-"
}

function formatTimeForInput(value) {
	if (!value) return ""
	return String(value).slice(0, 5)
}

function getServerError(payload) {
	if (payload?._server_messages) {
		try {
			const messages = JSON.parse(payload._server_messages)
				.map((message) => JSON.parse(message).message)
				.filter(Boolean)
			if (messages.length) return messages.join("\n")
		} catch {
			// Fall through to standard Frappe error fields.
		}
	}
	return payload?.message || payload?.exception || __("Unable to complete the attendance action.")
}

onMounted(() => {
	loadAttendanceStatus()
	socket.emit("doctype_subscribe", DOCTYPE)
	socket.on("list_update", (data) => {
		if (data.doctype == DOCTYPE) {
			checkins.reload()
			loadAttendanceStatus()
		}
	})
})

onBeforeUnmount(() => {
	socket.emit("doctype_unsubscribe", DOCTYPE)
	socket.off("list_update")
})
</script>
