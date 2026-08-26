<template>
	<ion-page>
		<ListView
			doctype="Compensatory Leave Request"
			:pageTitle="__('Comp-Off Requests')"
			:tabButtons="TAB_BUTTONS"
			:fields="COMPENSATORY_LEAVE_FIELDS"
			:filterConfig="FILTER_CONFIG"
		/>
	</ion-page>
</template>

<script setup>
import { IonPage } from "@ionic/vue"
import ListView from "@/components/ListView.vue"
import { inject } from "vue"

const __ = inject("$translate")
const TAB_BUTTONS = ["My Requests", "Team Requests"]

const COMPENSATORY_LEAVE_FIELDS = [
	"name",
	"employee",
	"employee_name",
	"leave_type",
	"work_from_date",
	"work_end_date",
	"half_day",
	"half_day_date",
	"reason",
	"docstatus",
]

const FILTER_CONFIG = [
	{
		fieldname: "leave_type",
		fieldtype: "Link",
		label: __("Leave Type"),
		options: "Leave Type",
	},
	{
		fieldname: "employee",
		fieldtype: "Link",
		label: __("Employee"),
		options: "Employee",
	},
	{
		fieldname: "department",
		fieldtype: "Link",
		label: __("Department"),
		options: "Department",
	},
	{ fieldname: "work_from_date", fieldtype: "Date", label: __("Work From Date") },
	{ fieldname: "work_end_date", fieldtype: "Date", label: __("Work End Date") },
]
</script>
