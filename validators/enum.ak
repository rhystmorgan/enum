use aiken/dict.{to_list}
use aiken/list.{any, has}
use aiken/transaction.{
  Input, Mint, Output, OutputReference, ScriptContext, Spend, Transaction,
  find_input, find_script_outputs,
}
use aiken/transaction/credential.{Script, ScriptCredential, VerificationKey}
use aiken/transaction/value.{
  AssetName, PolicyId, Value, from_minted_value, lovelace_of, policies, tokens,
}

type EAction {
  Alpha
  Beta
}

type EDatum {
  a: Int,
}

validator {
  fn emint(r: EAction, c: ScriptContext) -> Bool {
    let ScriptContext { transaction, purpose } = c
    expect Mint(policy) = purpose

    let Transaction { mint, .. } = transaction

    expect [(t_name, t_amt)] =
      mint
        |> from_minted_value
        |> tokens(policy)
        |> to_list()

    when r is {
      Alpha -> t_amt == 1
      Beta -> t_amt == -1
    }
  }
}

validator(p: PolicyId) {
  fn eval(d: EDatum, r: EAction, c: ScriptContext) -> Bool {
    let ScriptContext { transaction, purpose } = c
    expect Spend(oref) = purpose

    let Transaction { inputs, outputs, .. } = transaction

    when r is {
      Alpha -> any(outputs, fn(output) { has(policies(output.value), p) })
      Beta -> True
    }
  }
}
