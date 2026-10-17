const { Rule, LinValidator } = require('@core/lin-validator-v2')

class AskValidator extends LinValidator {
  constructor() {
    super()
    this.question = [
      new Rule('isLength', '问题长度需要在 1~200 字之间', { min: 1, max: 200 })
    ]
  }
}

module.exports = {
  AskValidator
}
