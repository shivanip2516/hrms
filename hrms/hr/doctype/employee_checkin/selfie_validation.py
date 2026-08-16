import frappe
from frappe import _

PWA_SOURCE = "PWA Selfie App"

def validate_checkin_selfie(doc, method=None):
	"""Require a selfie only for check-ins created through the PWA selfie app.
	Desk, biometric device sync, and generic API check-ins are unaffected."""
	if getattr(doc, "custom_checkin_source", None) == PWA_SOURCE and not doc.get("custom_selfie"):
		frappe.throw(_("A selfie is required to check in."))
