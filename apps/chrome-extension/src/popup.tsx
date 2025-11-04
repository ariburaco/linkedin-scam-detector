import React from "react";

import "./style.css";

const Popup = () => {
  return (
    <div className="w-[350px] p-4">
      <h1 className="mb-4 text-center text-xl font-bold">StreamSense</h1>
      <h1>Hello World</h1>
      <p>This is a test</p>
      <button>Click me</button>
      <input type="text" placeholder="Enter your name" />
      <select>
        <option value="1">Option 1</option>
        <option value="2">Option 2</option>
        <option value="3">Option 3</option>
      </select>
    </div>
  );
};

export default Popup;
