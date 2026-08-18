<template>
	<BaseLayout :pageTitle="__('Visits')">
		<template #body>
			<div class="flex flex-col gap-4 p-4 mt-3 mb-8 overflow-y-auto">
				<Button variant="solid" class="w-full py-5 text-base" @click="showAddModal = true">
					<template #prefix><FeatherIcon name="plus" class="w-4" /></template>
					{{ __('Add Visit') }}
				</Button>

				<div class="text-lg text-gray-800 font-bold">{{ __("Today's Visits") }}</div>
				<div v-if="loading" class="text-sm text-gray-500 text-center py-8">{{ __('Loading visits...') }}</div>
				<div v-else-if="!visits.length" class="bg-white rounded p-6 text-sm text-gray-500 text-center">
					{{ __('No visits planned for today.') }}
				</div>
				<div v-for="visit in visits" :key="visit.name" class="bg-white rounded border p-4 space-y-3">
					<div class="cursor-pointer" @click="openDetails(visit)">
						<div class="flex justify-between gap-3">
							<div class="font-semibold text-gray-900">{{ visit.customer }}</div>
							<Badge :label="__(visit.status)" :theme="statusTheme(visit.status)" />
						</div>
						<div v-if="visit.visit_type" class="text-sm text-gray-600 mt-1">{{ visit.visit_type }}</div>
						<div v-if="visit.status === 'In Progress'" class="text-sm text-gray-500 mt-2">
							{{ __('Started: {0}', [formatTime(visit.checkin_time)]) }}
						</div>
						<div v-if="visit.status === 'Completed'" class="text-sm text-gray-500 mt-2">
							{{ formatTime(visit.checkin_time) }} - {{ formatTime(visit.checkout_time) }}
						</div>
					</div>
					<div v-if="visit.status === 'Planned'" class="flex gap-2">
						<Button class="grow" variant="solid" :loading="actionName === visit.name" @click.stop="punch(visit, 'in')">{{ __('Punch In') }}</Button>
						<Button variant="subtle" theme="red" :disabled="actionName === visit.name" @click.stop="confirmCancel(visit)">{{ __('Cancel') }}</Button>
					</div>
					<Button v-else-if="visit.status === 'In Progress'" class="w-full" variant="solid" :loading="actionName === visit.name" @click.stop="punch(visit, 'out')">{{ __('Punch Out') }}</Button>
				</div>
			</div>
		</template>
	</BaseLayout>

	<ion-modal :is-open="showAddModal" @didDismiss="showAddModal = false">
		<div class="p-5 flex flex-col gap-4 overflow-y-auto h-full bg-white">
			<div class="flex justify-between items-center"><h2 class="text-xl font-bold">{{ __('Add Visit') }}</h2><Button variant="ghost" @click="showAddModal = false"><FeatherIcon name="x" /></Button></div>
			<label class="text-sm font-medium">{{ __('Customer') }}<Link v-model="newVisit.customer" doctype="Customer" /></label>
			<label class="text-sm font-medium">{{ __('Contact Person') }}<Link v-model="newVisit.contact_person" doctype="Contact" /></label>
			<label class="text-sm font-medium">{{ __('Address') }}<Link v-model="newVisit.address" doctype="Address" /></label>
			<label class="text-sm font-medium">{{ __('Visit Date') }}<input v-model="newVisit.visit_date" type="date" class="w-full border rounded px-3 py-2 mt-1" /></label>
			<label class="text-sm font-medium">{{ __('Visit Type') }}<input v-model="newVisit.visit_type" class="w-full border rounded px-3 py-2 mt-1" :placeholder="__('Customer Visit')" /></label>
			<label class="text-sm font-medium">{{ __('Visit Purpose') }}<textarea v-model="newVisit.visit_purpose" class="w-full border rounded px-3 py-2 mt-1" rows="2" /></label>
			<label class="text-sm font-medium">{{ __('Remarks') }}<textarea v-model="newVisit.remarks" class="w-full border rounded px-3 py-2 mt-1" rows="2" /></label>
			<Button variant="solid" class="w-full py-5" :loading="saving" @click="saveVisit">{{ __('Save Visit') }}</Button>
		</div>
	</ion-modal>

	<ion-modal :is-open="Boolean(selectedVisit)" @didDismiss="selectedVisit = null">
		<div v-if="selectedVisit" class="p-5 flex flex-col gap-4 h-full bg-white overflow-y-auto">
			<div class="flex justify-between items-center"><h2 class="text-xl font-bold">{{ selectedVisit.customer }}</h2><Button variant="ghost" @click="selectedVisit = null"><FeatherIcon name="x" /></Button></div>
			<VisitDetails :visit="selectedVisit" :formatTime="formatTime" />
		</div>
	</ion-modal>
</template>

<script setup>
import { inject, ref } from "vue"
import { IonModal } from "@ionic/vue"
import { Badge, FeatherIcon, toast } from "frappe-ui"
import BaseLayout from "@/components/BaseLayout.vue"
import Link from "@/components/Link.vue"

const __ = inject("$translate")
const dayjs = inject("$dayjs")
const visits = ref([])
const loading = ref(false)
const saving = ref(false)
const actionName = ref(null)
const showAddModal = ref(false)
const selectedVisit = ref(null)
const newVisit = ref(emptyVisit())

const visitApi = async (method, args = {}) => {
	const response = await fetch(`/api/method/dekure_custom.api.${method}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "X-Frappe-CSRF-Token": window.csrf_token },
		credentials: "same-origin",
		body: JSON.stringify(args),
	})
	const payload = await response.json()
	if (!response.ok || payload.exc) throw new Error(payload.message || __('Unable to complete the visit action.'))
	return payload.message
}

async function loadVisits() {
	loading.value = true
	try { visits.value = await visitApi("get_today_visits") } catch (error) { showError(error) } finally { loading.value = false }
}

async function saveVisit() {
	if (!newVisit.value.customer) return toast({ title: __('Customer is required'), icon: 'alert-circle', position: 'bottom-center', iconClasses: 'text-red-500' })
	saving.value = true
	try {
		await visitApi("create_visit", newVisit.value)
		showAddModal.value = false
		newVisit.value = emptyVisit()
		await loadVisits()
	} catch (error) { showError(error) } finally { saving.value = false }
}

async function punch(visit, direction) {
	actionName.value = visit.name
	try {
		const location = await getCurrentLocation()
		await visitApi(direction === 'in' ? "punch_in_visit" : "punch_out_visit", { name: visit.name, ...location })
		await loadVisits()
	} catch (error) { showError(error) } finally { actionName.value = null }
}

function getCurrentLocation() {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) return reject(new Error(__('Location is not supported by this browser.')))
		navigator.geolocation.getCurrentPosition(
			(position) => {
				const { latitude, longitude } = position.coords
				if (!latitude || !longitude) return reject(new Error(__('Unable to get your current location. Please enable location permission/GPS and try again.')))
				resolve({ latitude, longitude })
			},
			() => reject(new Error(__('Unable to get your current location. Please enable location permission/GPS and try again.'))),
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
		)
	})
}

async function confirmCancel(visit) {
	if (!window.confirm(__('Cancel this visit?'))) return
	actionName.value = visit.name
	try { await visitApi("cancel_visit", { name: visit.name }); await loadVisits() } catch (error) { showError(error) } finally { actionName.value = null }
}

async function openDetails(visit) {
	try { selectedVisit.value = await visitApi("get_visit", { name: visit.name }) } catch (error) { showError(error) }
}

function emptyVisit() { return { customer: "", contact_person: "", address: "", visit_date: dayjs().format("YYYY-MM-DD"), visit_type: "", visit_purpose: "", remarks: "" } }
function formatTime(value) { return value ? dayjs(value).format("h:mm A") : "-" }
function statusTheme(status) { return { Planned: 'gray', 'In Progress': 'orange', Completed: 'green', Cancelled: 'red' }[status] || 'gray' }
function showError(error) { toast({ title: __('Error'), text: error.message, icon: 'alert-circle', position: 'bottom-center', iconClasses: 'text-red-500' }) }

const VisitDetails = {
	props: ["visit", "formatTime"],
	template: `<div class="space-y-3 text-sm"><div><b>Status</b><div>{{ visit.status }}</div></div><div><b>Visit Date</b><div>{{ visit.visit_date }}</div></div><div v-if="visit.visit_type"><b>Visit Type</b><div>{{ visit.visit_type }}</div></div><div v-if="visit.visit_purpose"><b>Purpose</b><div>{{ visit.visit_purpose }}</div></div><div v-if="visit.checkin_time"><b>Check In</b><div>{{ formatTime(visit.checkin_time) }} · {{ visit.checkin_latitude }}, {{ visit.checkin_longitude }}</div></div><div v-if="visit.checkout_time"><b>Check Out</b><div>{{ formatTime(visit.checkout_time) }} · {{ visit.checkout_latitude }}, {{ visit.checkout_longitude }}</div></div><div v-if="visit.cancellation_reason"><b>Cancellation Reason</b><div>{{ visit.cancellation_reason }}</div></div></div>`,
}

loadVisits()
</script>
