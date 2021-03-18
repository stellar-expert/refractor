/**
 * Executes simple predicate match against a given object
 * @param {Object} value
 * @param {Object} predicate
 * @return {Boolean}
 */
function matchPredicate(value, predicate) {
    if (!value) return false
    for (let [key, condition] of Object.entries(predicate)) {
        const fieldValue = value[key]
        //equality match
        if (typeof condition !== 'object') {
            if (fieldValue !== condition) return false
        } else {
            //more complex condition in play
            for (let [operator, predicateValue] of Object.entries(condition)) {
                const func = operatorMatcher[operator]
                if (!func) throw new EvalError(`Unknown predicate operator: ${func}`)
                //evaluate condition predicate
                if (!func(predicateValue, fieldValue)) return false
            }
        }
    }
    return true
}

const operatorMatcher = {
    $gt(predicateValue, fieldValue) {
        return fieldValue > predicateValue
    },
    $gte(predicateValue, fieldValue) {
        return fieldValue >= predicateValue
    },
    $lt(predicateValue, fieldValue) {
        return fieldValue < predicateValue
    },
    $lte(predicateValue, fieldValue) {
        return fieldValue <= predicateValue
    },
    $in(predicateValue, fieldValue) {
        return predicateValue.includes(fieldValue)
    },
    $ne(predicateValue, fieldValue) {
        return fieldValue !== predicateValue
    }
}

module.exports = {matchPredicate}