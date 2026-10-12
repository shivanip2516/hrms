import { reactive } from "vue"

const handlers = new Map()
const inFlightRoutes = new Map()
const lastTriggeredAt = new Map()

export const refreshState = reactive({
	loading: false,
})

export function registerRefreshHandler(routeName, handler) {
	if (!routeName || typeof handler !== "function") {
		return () => {}
	}

	if (!handlers.has(routeName)) {
		handlers.set(routeName, new Set())
	}

	handlers.get(routeName).add(handler)

	return () => {
		handlers.get(routeName)?.delete(handler)
		if (!handlers.get(routeName)?.size) {
			handlers.delete(routeName)
		}
	}
}

export async function triggerRefresh(routeName, { force = false } = {}) {
	if (!routeName || !handlers.has(routeName)) return

	const now = Date.now()
	if (!force && now - (lastTriggeredAt.get(routeName) || 0) < 700) return
	lastTriggeredAt.set(routeName, now)

	if (inFlightRoutes.has(routeName)) {
		return inFlightRoutes.get(routeName)
	}

	const refreshPromise = Promise.allSettled(
		[...handlers.get(routeName)].map((handler) => handler())
	).finally(() => {
		inFlightRoutes.delete(routeName)
		refreshState.loading = false
	})

	inFlightRoutes.set(routeName, refreshPromise)
	refreshState.loading = true
	return refreshPromise
}
