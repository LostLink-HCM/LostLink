const createOnce = async (Model, fields) => {
  try {
    await Model.create(fields)
    return true
  } catch (error) {
    if (error.code === 11000) return false
    throw error
  }
}

module.exports = createOnce
