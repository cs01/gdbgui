import { PlusSmIcon } from "@heroicons/react/solid";
import { useState } from "react";
import { Expression, ExpressionClass } from "./Expression";
import { useGlobalValue } from "./Store";
import { store } from "./Store";

export function Watch(props: {}) {
  const expressions = useGlobalValue<typeof store.data.expressions>("expressions");
  const [userInput, setUserInput] = useState("");
  const [showInput, setShowInput] = useState(false);

  const submitExpression = () => {
    if (userInput) {
      ExpressionClass.createExpression(userInput, "expr");
    }
    setUserInput("");
    setShowInput(false);
  };
  const newWatchInput = (
    <div className="flex text-xs h-6">
      <input
        className={
          "bg-gray-800 flex-grow p-2 w-full mr-1 " +
          "rounded-sm focus:outline-none focus:ring-0 " +
          "text-sm "
        }
        autoFocus={true}
        placeholder="Expression to watch for changes"
        onChange={(e) => {
          setUserInput(e.target.value);
        }}
        onKeyUp={(e) => {
          if (e.code?.toLocaleLowerCase() === "enter") {
            submitExpression();
          } else if (e.code?.toLocaleLowerCase() === "escape") {
            setShowInput(false);
          }
        }}
        value={userInput}
      />
      <button
        className="btn-purple p-1 rounded"
        onClick={() => {
          submitExpression();
        }}
      >
        Create
      </button>
    </div>
  );
  return (
    <div>
      <div>
        {showInput ? (
          newWatchInput
        ) : (
          <div className="w-full text-left">
            <button
              className="w=full bg-black  hover:bg-purple-800 border-purple-800 flex whitespace-nowrap text-xs rounded-md align-middle p-1"
              onClick={() => setShowInput(true)}
            >
              <PlusSmIcon className="icon" />
              Watch New Expression
            </button>
          </div>
        )}
      </div>
      {expressions.map((expression) => {
        if (expression.expr_type === "expr") {
          return (
            <Expression
              key={expression.name}
              obj={expression}
              expr_type={expression.expr_type}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
