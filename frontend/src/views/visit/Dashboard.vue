<template>
	<BaseLayout :pageTitle="__('Visits')">
		<template #body>
			<div class="flex flex-col gap-4 p-4 mt-3 mb-8 overflow-y-auto">
				<Button variant="solid" class="w-full py-5 text-base" @click="openAddModal">
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
							<div class="font-semibold text-gray-900">{{ visit.customer_name || visit.customer || visit.new_customer }}</div>
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

	<!-- Add Visit Modal -->
	<ion-modal :is-open="showAddModal" @didDismiss="showAddModal = false">
		<div class="p-5 flex flex-col gap-4 overflow-y-auto h-full bg-white">
			<div class="flex justify-between items-center">
				<h2 class="text-xl font-bold">{{ __('Add Visit') }}</h2>
				<Button variant="ghost" @click="showAddModal = false"><FeatherIcon name="x" /></Button>
			</div>

			<!-- Customer Type Switcher -->
			<div class="flex flex-col gap-1.5">
				<div class="text-sm font-medium text-gray-700">{{ __('Customer Selection') }}</div>
				<div class="grid grid-cols-2 p-1 bg-gray-100 rounded-lg gap-1">
					<button
						type="button"
						class="py-2 text-sm font-medium rounded-md transition-all text-center"
						:class="customerType === 'Existing Customer' ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-600 hover:text-gray-900'"
						@click="customerType = 'Existing Customer'"
					>
						{{ __('Existing Customer') }}
					</button>
					<button
						type="button"
						class="py-2 text-sm font-medium rounded-md transition-all text-center"
						:class="customerType === 'New Customer' ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-600 hover:text-gray-900'"
						@click="customerType = 'New Customer'"
					>
						{{ __('New Customer') }}
					</button>
				</div>
			</div>

			<!-- Existing Customer Field -->
			<div v-if="customerType === 'Existing Customer'" class="flex flex-col gap-1">
				<label class="text-sm font-medium text-gray-700">{{ __('Existing Customer') }}</label>
				<Link v-model="newVisit.customer" doctype="Customer" />
			</div>

			<!-- New Customer Field -->
			<div v-else class="flex flex-col gap-1">
				<div class="flex justify-between items-center">
					<label class="text-sm font-medium text-gray-700">{{ __('New Customer') }}</label>
					<button type="button" class="text-xs font-semibold text-blue-600 hover:text-blue-800" @click="showAddCustomerModal = true">
						+ {{ __('Add New') }}
					</button>
				</div>
				<Autocomplete
					v-model="selectedNewCustomerOption"
					:options="newCustomerOptions"
					:placeholder="__('Select New Customer or Add New')"
					@update:query="searchNewCustomers"
				/>
			</div>

			<!-- Contact Person Field -->
			<div class="flex flex-col gap-1">
				<label class="text-sm font-medium text-gray-700">{{ __('Contact Person') }}</label>
				<input
					v-model="newVisit.contact_person"
					type="text"
					class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
					:placeholder="__('Contact person name')"
				/>
			</div>

			<!-- Address Field -->
			<div class="flex flex-col gap-1">
				<label class="text-sm font-medium text-gray-700">{{ __('Address') }}</label>
				<textarea
					v-model="newVisit.address"
					class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
					rows="2"
					:placeholder="__('Enter visit address')"
				></textarea>
			</div>

			<div class="flex flex-col gap-1">
				<label class="text-sm font-medium text-gray-700">{{ __('Visit Date') }}</label>
				<input v-model="newVisit.visit_date" type="date" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
			</div>

			<div class="flex flex-col gap-1">
				<label class="text-sm font-medium text-gray-700">{{ __('Visit Type') }}</label>
				<input v-model="newVisit.visit_type" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" :placeholder="__('Customer Visit')" />
			</div>

			<div class="flex flex-col gap-1">
				<label class="text-sm font-medium text-gray-700">{{ __('Visit Purpose') }}</label>
				<textarea v-model="newVisit.visit_purpose" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" rows="2" />
			</div>

			<div class="flex flex-col gap-1">
				<label class="text-sm font-medium text-gray-700">{{ __('Remarks') }}</label>
				<textarea v-model="newVisit.remarks" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" rows="2" />
			</div>

			<Button variant="solid" class="w-full py-5" :loading="saving" @click="saveVisit">{{ __('Save Visit') }}</Button>
		</div>
	</ion-modal>

	<!-- Add New Customer Modal -->
	<ion-modal :is-open="showAddCustomerModal" @didDismiss="showAddCustomerModal = false">
		<div class="p-5 flex flex-col gap-4 overflow-y-auto h-full bg-white">
			<div class="flex justify-between items-center">
				<h2 class="text-xl font-bold">{{ __('Add New Customer') }}</h2>
				<Button variant="ghost" @click="showAddCustomerModal = false"><FeatherIcon name="x" /></Button>
			</div>
			<div class="text-xs text-gray-500">{{ __('This customer will be saved specifically for PWA Visits.') }}</div>

			<div class="flex flex-col gap-1">
				<label class="text-sm font-medium text-gray-700">{{ __('Customer Name') }} <span class="text-red-500">*</span></label>
				<input
					v-model="newCustomerForm.customer_name"
					type="text"
					class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
					:placeholder="__('Enter customer name')"
				/>
			</div>

			<div class="flex flex-col gap-1">
				<label class="text-sm font-medium text-gray-700">{{ __('Contact Person') }}</label>
				<input
					v-model="newCustomerForm.contact_person"
					type="text"
					class="w-full border border-gray-300 rounded px-3 py-2 text-sm"
					:placeholder="__('Contact person')"
				/>
			</div>

			<div class="flex flex-col gap-1">
				<label class="text-sm font-medium text-gray-700">{{ __('Mobile No') }}</label>
				<input
					v-model="newCustomerForm.mobile_no"
					type="tel"
					class="w-full border border-gray-300 rounded px-3 py-2 text-sm"
					:placeholder="__('Mobile number')"
				/>
			</div>

			<div class="flex flex-col gap-1">
				<label class="text-sm font-medium text-gray-700">{{ __('Email') }}</label>
				<input
					v-model="newCustomerForm.email"
					type="email"
					class="w-full border border-gray-300 rounded px-3 py-2 text-sm"
					:placeholder="__('Email address')"
				/>
			</div>

			<div class="flex flex-col gap-1">
				<label class="text-sm font-medium text-gray-700">{{ __('Address') }}</label>
				<textarea
					v-model="newCustomerForm.address"
					class="w-full border border-gray-300 rounded px-3 py-2 text-sm"
					rows="2"
					:placeholder="__('Customer address')"
				></textarea>
			</div>

			<div class="flex gap-2 mt-2">
				<Button variant="subtle" class="w-1/2 py-3" @click="showAddCustomerModal = false">{{ __('Cancel') }}</Button>
				<Button variant="solid" class="w-1/2 py-3" :loading="savingCustomer" @click="saveCustomer">{{ __('Save Customer') }}</Button>
			</div>
		</div>
	</ion-modal>

	<!-- Visit Details Modal -->
	<ion-modal :is-open="Boolean(selectedVisit)" @didDismiss="selectedVisit = null">
		<div v-if="selectedVisit" class="p-5 flex flex-col gap-4 h-full bg-white overflow-y-auto">
			<div class="flex justify-between items-center">
				<h2 class="text-xl font-bold">{{ selectedVisit.customer_name || selectedVisit.customer || selectedVisit.new_customer }}</h2>
				<Button variant="ghost" @click="selectedVisit = null"><FeatherIcon name="x" /></Button>
			</div>
			<VisitDetails :visit="selectedVisit" :formatTime="formatTime" />
		</div>
	</ion-modal>
</template>

<script setup>
import { inject, onMounted, ref, computed } from "vue"
import { IonModal } from "@ionic/vue"
import { Badge, FeatherIcon, Autocomplete, toast } from "frappe-ui"
import BaseLayout from "@/components/BaseLayout.vue"
import Link from "@/components/Link.vue"

const __ = inject("$translate")
const dayjs = inject("$dayjs")
const visits = ref([])
const loading = ref(false)
const saving = ref(false)
const savingCustomer = ref(false)
const actionName = ref(null)
const showAddModal = ref(false)
const showAddCustomerModal = ref(false)
const selectedVisit = ref(null)
const customerType = ref("Existing Customer")
const newVisit = ref(emptyVisit())
const visitCustomers = ref([])
const customerQuery = ref("")

const newCustomerForm = ref({
	customer_name: "",
	contact_person: "",
	mobile_no: "",
	email: "",
	address: "",
})

const ADD_NEW_VALUE = "__ADD_NEW__"

const newCustomerOptions = computed(() => {
	const list = (visitCustomers.value || []).map((c) => {
		const name = c.name || c.value || ""
		const customerName = c.customer_name || c.label || name
		return {
			label: customerName || name,
			value: name,
			customer_name: customerName,
			contact_person: c.contact_person || "",
			mobile_no: c.mobile_no || "",
			email: c.email || "",
			address: c.address || "",
			data: c,
		}
	})
	list.push({
		label: `+ ${__("Add New...")}`,
		value: ADD_NEW_VALUE,
	})
	return list
})

const selectedNewCustomerOption = computed({
	get: () => {
		const selectedId = newVisit.value.new_customer
		if (!selectedId) return ""
		const match = (visitCustomers.value || []).find(
			(c) => (c.name || c.value) === selectedId
		)
		if (match) {
			const label = match.customer_name || match.label || match.name || match.value || selectedId
			return {
				label: label,
				value: match.name || match.value || selectedId,
			}
		}
		return {
			label: selectedId,
			value: selectedId,
		}
	},
	set: (val) => {
		const rawVal = typeof val === "string" ? val : val?.value
		if (rawVal === ADD_NEW_VALUE) {
			showAddCustomerModal.value = true
			return
		}
		newVisit.value.new_customer = rawVal || ""
		const customerData =
			val?.data ||
			(val?.contact_person !== undefined || val?.address !== undefined ? val : null) ||
			(visitCustomers.value || []).find((c) => (c.name || c.value) === rawVal)

		if (customerData) {
			if (!newVisit.value.contact_person && customerData.contact_person) {
				newVisit.value.contact_person = customerData.contact_person
			}
			if (!newVisit.value.address && customerData.address) {
				newVisit.value.address = customerData.address
			}
		}
	},
})

const visitApi = async (method, args = {}) => {
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

async function loadVisits() {
	loading.value = true
	try { visits.value = await visitApi("get_today_visits") } catch (error) { showError(error) } finally { loading.value = false }
}

async function loadVisitCustomers(txt = "") {
	try {
		const res = await visitApi("get_visit_customers", { txt })
		visitCustomers.value = res || []
	} catch (e) {
		console.error("Failed to load visit customers", e)
	}
}

function searchNewCustomers(query) {
	customerQuery.value = query || ""
	loadVisitCustomers(query)
}

function openAddModal() {
	newVisit.value = emptyVisit()
	customerType.value = "Existing Customer"
	loadVisitCustomers()
	showAddModal.value = true
}

async function saveCustomer() {
	if (!newCustomerForm.value.customer_name?.trim()) {
		return toast({
			title: __('Customer Name is required'),
			icon: 'alert-circle',
			position: 'bottom-center',
			iconClasses: 'text-red-500',
		})
	}
	savingCustomer.value = true
	try {
		const created = await visitApi("create_visit_customer", newCustomerForm.value)
		toast({
			title: __('New customer created'),
			icon: 'check',
			position: 'bottom-center',
			iconClasses: 'text-green-500',
		})
		await loadVisitCustomers()
		newVisit.value.new_customer = created.name
		if (!newVisit.value.contact_person && created.contact_person) {
			newVisit.value.contact_person = created.contact_person
		}
		if (!newVisit.value.address && created.address) {
			newVisit.value.address = created.address
		}
		newCustomerForm.value = {
			customer_name: "",
			contact_person: "",
			mobile_no: "",
			email: "",
			address: "",
		}
		showAddCustomerModal.value = false
	} catch (error) {
		showError(error)
	} finally {
		savingCustomer.value = false
	}
}

async function saveVisit() {
	if (customerType.value === "Existing Customer" && !newVisit.value.customer) {
		return toast({
			title: __('Existing Customer is required'),
			icon: 'alert-circle',
			position: 'bottom-center',
			iconClasses: 'text-red-500',
		})
	}
	if (customerType.value === "New Customer" && !newVisit.value.new_customer) {
		return toast({
			title: __('New Customer is required'),
			icon: 'alert-circle',
			position: 'bottom-center',
			iconClasses: 'text-red-500',
		})
	}
	saving.value = true
	try {
		await visitApi("create_visit", {
			...newVisit.value,
			customer_type: customerType.value,
			customer: customerType.value === "Existing Customer" ? newVisit.value.customer : null,
			new_customer: customerType.value === "New Customer" ? newVisit.value.new_customer : null,
		})
		showAddModal.value = false
		newVisit.value = emptyVisit()
		await loadVisits()
	} catch (error) {
		showError(error)
	} finally {
		saving.value = false
	}
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
				if (
					typeof latitude !== "number" ||
					typeof longitude !== "number" ||
					(latitude === 0 && longitude === 0)
				) {
					return reject(new Error(__('Unable to get your current location. Please enable location permission/GPS and try again.')))
				}
				resolve({ latitude, longitude })
			},
			(error) => reject(new Error(getLocationError(error))),
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

function emptyVisit() {
	return {
		customer_type: "Existing Customer",
		customer: "",
		new_customer: "",
		contact_person: "",
		address: "",
		visit_date: dayjs().format("YYYY-MM-DD"),
		visit_type: "",
		visit_purpose: "",
		remarks: "",
	}
}

function formatTime(value) { return value ? dayjs(value).format("h:mm A") : "-" }
function statusTheme(status) { return { Planned: 'gray', 'In Progress': 'orange', Completed: 'green', Cancelled: 'red' }[status] || 'gray' }
function showError(error) { toast({ title: __('Error'), text: error.message, icon: 'alert-circle', position: 'bottom-center', iconClasses: 'text-red-500' }) }
function getLocationError(error) {
	if (error?.code === error?.PERMISSION_DENIED) {
		return __('Location permission is required to punch a visit. Please allow location access and try again.')
	}
	if (error?.code === error?.TIMEOUT) {
		return __('Unable to get your location in time. Please check GPS/signal and try again.')
	}
	return __('Unable to get your current location. Please enable location permission/GPS and try again.')
}
function getServerError(payload) {
	if (payload?._server_messages) {
		try {
			const messages = JSON.parse(payload._server_messages)
				.map((message) => JSON.parse(message).message)
				.filter(Boolean)
			if (messages.length) return messages.join("\n")
		} catch {
			// Fall through to the normal Frappe message/error fields.
		}
	}
	return payload?.message || payload?.exception || __('Unable to complete the visit action.')
}

const VisitDetails = {
	props: ["visit", "formatTime"],
	template: `
		<div class="space-y-3 text-sm">
			<div><b>Status</b><div>{{ visit.status }}</div></div>
			<div><b>Customer Type</b><div>{{ visit.customer_type || 'Existing Customer' }}</div></div>
			<div><b>Customer</b><div>{{ visit.customer_name || visit.customer || visit.new_customer }}</div></div>
			<div v-if="visit.contact_person"><b>Contact Person</b><div>{{ visit.contact_person }}</div></div>
			<div v-if="visit.address"><b>Address</b><div>{{ visit.address }}</div></div>
			<div><b>Visit Date</b><div>{{ visit.visit_date }}</div></div>
			<div v-if="visit.visit_type"><b>Visit Type</b><div>{{ visit.visit_type }}</div></div>
			<div v-if="visit.visit_purpose"><b>Purpose</b><div>{{ visit.visit_purpose }}</div></div>
			<div v-if="visit.remarks"><b>Remarks</b><div>{{ visit.remarks }}</div></div>
			<div v-if="visit.checkin_time">
				<b>Check In</b>
				<div>{{ formatTime(visit.checkin_time) }} · {{ visit.checkin_latitude }}, {{ visit.checkin_longitude }}</div>
				<div v-if="visit.checkin_address" class="text-gray-600 mt-1">{{ visit.checkin_address }}</div>
			</div>
			<div v-if="visit.checkout_time">
				<b>Check Out</b>
				<div>{{ formatTime(visit.checkout_time) }} · {{ visit.checkout_latitude }}, {{ visit.checkout_longitude }}</div>
				<div v-if="visit.checkout_address" class="text-gray-600 mt-1">{{ visit.checkout_address }}</div>
			</div>
			<div v-if="visit.cancellation_reason"><b>Cancellation Reason</b><div>{{ visit.cancellation_reason }}</div></div>
		</div>
	`,
}

onMounted(loadVisits)
</script>
