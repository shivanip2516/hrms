<template>
	<ion-page>
		<ion-content :fullscreen="true">
			<FormView
				v-if="formFields.data"
				doctype="Compensatory Leave Request"
				v-model="compensatoryLeaveRequest"
				:isSubmittable="true"
				:fields="formFields.data"
				:id="props.id"
				@validateForm="validateForm"
			/>
		</ion-content>
	</ion-page>
</template>

<script setup>
import { IonPage, IonContent } from "@ionic/vue"
import { createResource } from "frappe-ui"
import { ref, watch, inject } from "vue"

import FormView from "@/components/FormView.vue"

const employee = inject("$employee")
const __ = inject("$translate")

const props = defineProps({
	id: {
		type: String,
		required: false,
	},
})

// reactive object to store form data
const compensatoryLeaveRequest = ref({})

// get form fields
const formFields = createResource({
	url: "hrms.api.get_doctype_fields",
	params: { doctype: "Compensatory Leave Request" },
	auto: true,
	transform(data) {
		let fields = data
		if (!props.id) {
			fields = data.filter(
				(field) =>
					!["employee", "employee_name", "department", "leave_allocation", "amended_from"].includes(
						field.fieldname
					)
			)
		}
		return fields.map((field) => {
			if (field.fieldname === "half_day_date") {
				field.hidden = true
			}
			if (field.fieldname === "leave_type") {
				field.linkFilters = { is_compensatory: 1 }
			}
			return field
		})
	},
	onSuccess() {
		compensatoryLeaveTypes.reload()
	},
})

const compensatoryLeaveTypes = createResource({
	url: "frappe.client.get_list",
	params: {
		doctype: "Leave Type",
		filters: { is_compensatory: 1 },
		fields: ["name"],
	},
	auto: !props.id,
	onSuccess(data) {
		const leaveTypeField = formFields.data?.find((field) => field.fieldname === "leave_type")
		if (leaveTypeField && data?.length) {
			leaveTypeField.documentList = data.map((d) => ({
				label: d.name,
				value: d.name,
			}))
			if (!compensatoryLeaveRequest.value.leave_type && data.length === 1) {
				compensatoryLeaveRequest.value.leave_type = data[0].name
			}
		}
	},
})

// form scripts
watch(
	() => compensatoryLeaveRequest.value.employee,
	(employee_id) => {
		if (props.id && employee_id !== employee.data?.name) {
			setFormReadOnly()
		}
	}
)

watch(
	() => compensatoryLeaveRequest.value.work_from_date,
	(work_from_date) => {
		if (!compensatoryLeaveRequest.value.work_end_date) {
			compensatoryLeaveRequest.value.work_end_date = work_from_date
		}
	}
)

watch(
	() => [compensatoryLeaveRequest.value.work_from_date, compensatoryLeaveRequest.value.work_end_date],
	([work_from_date, work_end_date]) => {
		validateDates(work_from_date, work_end_date)
	}
)

watch(
	() => compensatoryLeaveRequest.value.half_day,
	(half_day) => {
		const half_day_date = formFields.data?.find((field) => field.fieldname === "half_day_date")
		if (half_day_date) {
			half_day_date.hidden = !half_day
			half_day_date.reqd = Boolean(half_day)
		}
	}
)

// helper functions
function setFormReadOnly() {
	formFields.data?.map((field) => (field.read_only = true))
}

function validateDates(work_from_date, work_end_date) {
	if (!(work_from_date && work_end_date)) return

	const error_message =
		work_from_date > work_end_date ? __("Work End Date cannot be before Work From Date") : ""

	const work_from_date_field = formFields.data?.find((field) => field.fieldname === "work_from_date")
	if (work_from_date_field) {
		work_from_date_field.error_message = error_message
	}
}

function validateForm() {
	compensatoryLeaveRequest.value.employee = employee.data?.name
}
</script>
