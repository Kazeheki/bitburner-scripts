/**
 * 
 * @param {any} value 
 * @param {string} field_name
 */
export function assure_not_blank(value, field_name = "Field") {
    if (value == null) {
        throw Error(`${field_name} must not be null`);
    }
    if (typeof value === "string" && value.trim().length === 0) {
        throw Error(`${field_name} must not be blank`);
    }
}