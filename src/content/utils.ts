import { debugBuilder, errorBuilder, warnBuilder } from "../shared/utils/logging"

export const CONTENT_PREFIX = 'ConTeNt DEBUG'

export const error = errorBuilder();
export const warn = warnBuilder();
export const debug = debugBuilder();
