<template>
	<div v-if="showField" class="flex flex-col gap-1.5">
		<!-- Label -->
		<span
			v-if="!['Check', 'Section Break', 'Column Break'].includes(props.fieldtype)"
			:class="[
				// mark field as mandatory
				props.reqd ? `after:content-['_*'] after:text-red-600` : ``,
				`block text-sm leading-5 text-gray-700`,
			]"
		>
			{{ props.label }}
		</span>

		<!-- Select or Link field with predefined options -->
		<Autocomplete
			v-if="props.fieldtype === 'Select' || props.documentList"
			:class="isReadOnly ? 'pointer-events-none' : ''"
			:placeholder="__('Select {0}', [props.label])"
			:options="selectionList"
			:modelValue="modelValue"
			v-bind="$attrs"
			:disabled="isReadOnly"
			@update:modelValue="(v) => emit('update:modelValue', v?.value)"
		/>

		<!-- Link field -->
		<Link
			v-else-if="props.fieldtype === 'Link'"
			:doctype="props.options"
			:modelValue="modelValue"
			:filters="props.linkFilters"
			:disabled="isReadOnly"
			@update:modelValue="(v) => emit('update:modelValue', v)"
		/>

		<TextEditor
			v-else-if="props.fieldtype === 'Text Editor'"
			:content="modelValue"
			:placeholder="__('Enter {0}', [props.label])"
			@change="(v) => emit('update:modelValue', v)"
			:fixedMenu="true"
			:editable="!isReadOnly"
			editor-class="prose-sm border-b border-x border-gray-200 rounded-b-sm p-1 min-h-[4rem]"
		/>

		<!-- Text -->
		<Input
			v-else-if="['Small Text', 'Text', 'Long Text'].includes(props.fieldtype)"
			type="textarea"
			:value="modelValue"
			:placeholder="__('Enter {0}', [props.label])"
			@input="(v) => emit('update:modelValue', v)"
			@change="(v) => emit('change', v)"
			v-bind="$attrs"
			:disabled="isReadOnly"
			class="h-15"
		/>

		<!-- Check -->
		<Input
			v-else-if="props.fieldtype === 'Check'"
			type="checkbox"
			:label="props.label"
			:value="modelValue"
			@input="(v) => emit('update:modelValue', v)"
			@change="(v) => emit('change', v)"
			v-bind="$attrs"
			:disabled="isReadOnly"
			class="rounded-sm text-gray-800"
		/>

		<!-- Data field -->
		<Input
			v-else-if="props.fieldtype === 'Data'"
			type="text"
			:value="modelValue"
			@input="(v) => emit('update:modelValue', v)"
			@change="(v) => emit('change', v)"
			v-bind="$attrs"
			:disabled="isReadOnly"
		/>

		<!-- Read only currency field -->
		<Input
			v-else-if="props.fieldtype === 'Currency' && isReadOnly"
			type="text"
			:value="modelValue"
			@input="(v) => emit('update:modelValue', v)"
			@change="(v) => emit('change', v)"
			v-bind="$attrs"
			:disabled="isReadOnly"
		/>

		<!-- Float/Int field -->
		<Input
			v-else-if="isNumberType"
			type="number"
			:value="modelValue"
			@input="(v) => emit('update:modelValue', v)"
			@change="(v) => emit('change', v)"
			v-bind="$attrs"
			:disabled="isReadOnly"
		/>

		<!-- Attach -->
		<div v-else-if="props.fieldtype === 'Attach'" class="flex flex-col gap-2">
			<input
				ref="fileInput"
				type="file"
				accept="*"
				class="hidden"
				:disabled="isReadOnly || isUploading"
				@change="handleAttachmentSelect"
			/>
			<div class="flex items-center gap-2">
				<button
					type="button"
					class="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-700 disabled:bg-gray-100 disabled:text-gray-500"
					:disabled="isReadOnly || isUploading"
					@click="fileInput?.click()"
				>
					{{ isUploading ? __("Uploading...") : attachmentFileName || __("Choose File") }}
				</button>
				<button
					v-if="modelValue && !isReadOnly"
					type="button"
					class="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
					:disabled="isUploading"
					@click="clearAttachment"
				>
					{{ __("Clear") }}
				</button>
			</div>
			<a
				v-if="modelValue"
				:href="modelValue"
				target="_blank"
				rel="noopener noreferrer"
				class="text-sm text-blue-600"
			>
				{{ __("View Attachment") }}
			</a>
		</div>

		<!-- Section Break -->
		<div
			v-else-if="props.fieldtype === 'Section Break'"
			:class="props.addSectionPadding ? 'mt-2' : ''"
		>
			<h2
				v-if="props.label"
				class="text-base font-semibold text-gray-800"
				:class="props.addSectionPadding ? 'pt-4' : ''"
			>
				{{ props.label }}
			</h2>
		</div>

		<!-- Date -->
		<!-- FIXME: default datepicker has poor UI -->
		<Input
			v-else-if="props.fieldtype === 'Date'"
			type="date"
			:value="modelValue"
			:placeholder="__('Select {0}', [props.label])"
			:formatValue="(val) => dayjs(val).format('DD-MM-YYYY')"
			@input="(v) => emit('update:modelValue', v)"
			@change="(v) => emit('change', v)"
			v-bind="$attrs"
			:disabled="isReadOnly"
			:min="props.minDate"
			:max="props.maxDate"
		/>

		<!-- Time -->
		<!-- Datetime -->
		<DateTimePicker
			v-else-if="props.fieldtype === 'Datetime'"
			:value="modelValue"
			:placeholder="`Select ${props.label}`"
			:formatter="(val) => dayjs(val).format('DD-MM-YYYY HH:mm:ss')"
			@update:modelValue="(v) => emit('update:modelValue', v)"
			v-bind="$attrs"
			:disabled="isReadOnly"
		/>

		<ErrorMessage :message="props.errorMessage" />
	</div>
</template>

<script setup>
import { Autocomplete, DateTimePicker, ErrorMessage, Input, TextEditor, createResource, toast } from "frappe-ui"
import { computed, onMounted, inject, ref } from "vue"

import Link from "@/components/Link.vue"

const __ = inject("$translate")

const props = defineProps({
	fieldtype: String,
	fieldname: String,
	modelValue: [String, Number, Boolean, Array, Object],
	default: [String, Number, Boolean, Array, Object],
	label: String,
	options: [String, Array],
	linkFilters: Object,
	documentList: Array,
	readOnly: [Boolean, Number],
	reqd: [Boolean, Number],
	hidden: {
		type: [Boolean, Number],
		default: false,
	},
	errorMessage: String,
	minDate: String,
	maxDate: String,
	addSectionPadding: {
		type: Boolean,
		default: true,
	},
})

const emit = defineEmits(["change", "update:modelValue"])
const dayjs = inject("$dayjs")
const fileInput = ref(null)
const isUploading = ref(false)
const selectedAttachmentName = ref("")

const attachmentUploader = createResource({
	url: "dekure_custom.api.upload_pwa_expense_row_attachment",
	onError(error) {
		toast({
			title: __("Error"),
			text: error.messages?.[0] || __("File upload failed."),
			icon: "alert-circle",
			position: "bottom-center",
			iconClasses: "text-red-500",
		})
	},
})

const showField = computed(() => {
	if (props.readOnly && !isLayoutField.value && !props.modelValue) return false

	return props.fieldtype !== "Table" && !props.hidden
})

const isNumberType = computed(() => {
	return ["Int", "Float", "Currency"].includes(props.fieldtype)
})

const isLayoutField = computed(() => {
	return ["Section Break", "Column Break"].includes(props.fieldtype)
})

const isReadOnly = computed(() => {
	return Boolean(props.readOnly)
})

const selectionList = computed(() => {
	if (props.fieldtype === "Link" && props.documentList) {
		return props.documentList
	} else if (props.fieldtype == "Select" && props.options) {
		const options = props.options.split("\n")
		return options.map((option) => ({
			label: __(option),
			value: option,
		}))
	}

	return []
})

const attachmentFileName = computed(() => {
	if (selectedAttachmentName.value) return selectedAttachmentName.value
	if (!props.modelValue) return ""

	return decodeURIComponent(String(props.modelValue).split("/").pop() || props.modelValue)
})

function handleAttachmentSelect(event) {
	const file = event.target.files?.[0]
	if (!file) return

	const reader = new FileReader()
	isUploading.value = true

	reader.onload = async () => {
		try {
			const content = reader.result.toString().split(",")[1]
			const fileDoc = await attachmentUploader.submit({
				content,
				filename: file.name,
			})
			selectedAttachmentName.value = fileDoc.file_name || file.name
			emit("update:modelValue", fileDoc.file_url)
		} finally {
			isUploading.value = false
			if (fileInput.value) fileInput.value.value = ""
		}
	}

	reader.onerror = () => {
		isUploading.value = false
		toast({
			title: __("Error"),
			text: __("File upload failed."),
			icon: "alert-circle",
			position: "bottom-center",
			iconClasses: "text-red-500",
		})
	}

	reader.readAsDataURL(file)
}

function clearAttachment() {
	selectedAttachmentName.value = ""
	emit("update:modelValue", "")
}

function setDefaultValue() {
	// set default values
	if (props.modelValue) return

	if (props.default) {
		if (props.fieldtype === "Check") {
			emit("update:modelValue", props.default === "1" ? true : false)
		} else if (props.fieldtype === "Date" && props.default === "Today") {
			emit("update:modelValue", dayjs().format("YYYY-MM-DD"))
		} else if (isNumberType.value) {
			emit("update:modelValue", parseFloat(props.default || 0))
		} else {
			emit("update:modelValue", props.default)
		}
	} else {
		props.fieldtype === "Check" ? emit("update:modelValue", false) : emit("update:modelValue", "")
	}
}

onMounted(() => {
	setDefaultValue()
})
</script>
