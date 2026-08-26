<template>
	<ListItem
		:isTeamRequest="props.isTeamRequest"
		:employee="props.doc.employee"
		:employeeName="props.doc.employee_name"
	>
		<template #left>
			<LeaveIcon class="h-5 w-5 text-gray-500" />
			<div class="flex flex-col items-start gap-1.5">
				<div class="text-base font-normal text-gray-800">
					{{ __(props.doc.leave_type || "Compensatory Off", null, "Leave Type") }}
				</div>
				<div class="text-xs font-normal text-gray-500">
					<span>{{ getWorkDates(props.doc) }}</span>
					<span v-if="props.doc.half_day" class="whitespace-pre"> &middot; </span>
					<span v-if="props.doc.half_day" class="whitespace-nowrap">{{ __("Half Day") }}</span>
				</div>
			</div>
		</template>
		<template #right>
			<Badge variant="outline" :theme="colorMap[status]" :label="__(status, null, 'Compensatory Leave Request')" size="md" />
			<FeatherIcon name="chevron-right" class="h-5 w-5 text-gray-500" />
		</template>
	</ListItem>
</template>

<script setup>
import { computed, inject } from "vue"
import { FeatherIcon, Badge } from "frappe-ui"

import ListItem from "@/components/ListItem.vue"
import LeaveIcon from "@/components/icons/LeaveIcon.vue"

const dayjs = inject("$dayjs")
const __ = inject("$translate")

const props = defineProps({
	doc: {
		type: Object,
		required: true,
	},
	isTeamRequest: {
		type: Boolean,
		default: false,
	},
	workflowStateField: {
		type: String,
		required: false,
	},
})

const status = computed(() => {
	if (props.workflowStateField && props.doc[props.workflowStateField]) {
		return props.doc[props.workflowStateField]
	}
	if (props.doc.docstatus === 1) return "Approved"
	if (props.doc.docstatus === 2) return "Cancelled"
	return "Draft"
})

const colorMap = {
	Approved: "green",
	Cancelled: "red",
	Draft: "orange",
	Open: "orange",
	Rejected: "red",
}

function getWorkDates(doc) {
	if (!doc.work_from_date) return ""
	if (doc.work_from_date === doc.work_end_date || !doc.work_end_date) {
		return dayjs(doc.work_from_date).format("D MMM")
	}
	return `${dayjs(doc.work_from_date).format("D MMM")} - ${dayjs(doc.work_end_date).format("D MMM")}`
}
</script>
