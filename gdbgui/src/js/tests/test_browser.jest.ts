function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function close_test(browser: any, exe_python_server:any, exe_gdb_server:any) {
    const { exec, spawn } = require("child_process");
    await browser.close();

    exe_python_server.kill("SIGTERM");

    // execute killing command kill does not propagate to all child processes
    console.log("Killing:", exe_gdb_server.pid.toString());
    let kill_cmd = spawn("bash", ["-c", "pkill mpirun"]);
    await sleep(3000)
}

test("debug session", () => {
  var expect = require("chai").expect;

  const { exec, spawn } = require("child_process");

  // Script with spaces in the filename:
  const exe_gdb_server = spawn(
    "./gdbgui-mpi/launch_mpi_debugger",
    ["6", "gdbgui-mpi/print_nodes"],
    { shell: true }
  );
  const exe_python_server = spawn("python", ["-m", "gdbgui", "-n"]);

  const puppeteer = require("puppeteer");

  return (async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.waitFor(2000)
    await page.goto("http://127.0.0.1:5000");

    // Load page and connect to server and debug
    const loaded = await page.evaluate(() => {
      let top_div = document.getElementById("top");
      if (top_div == null) {
        return false;
      }

      let menu_button:HTMLElement = top_div.querySelector("button.dropdown-toggle") as HTMLElement;
      if (menu_button == null) {
        return false;
      }

      menu_button.click();

      let a_point:HTMLElement = top_div.querySelectorAll("a.pointer")[3] as HTMLElement;
      if (a_point == null || a_point.innerText != "Connect to MPI gdbservers") {
        return false;
      }
      a_point.click();

      let connect_button:HTMLElement = top_div.querySelectorAll("button.btn-primary")[1] as HTMLElement;
      if (
        connect_button == null ||
        connect_button.innerText != "Connect to mpi-gdbserver"
      ) {
        return false;
      }

      connect_button.click();

      return document.innerText;
    });

    console.log("Connecting and select MPI session:", loaded);
//    if (loaded == false) {
      await close_test(browser, exe_python_server, exe_gdb_server)
      return false;
//    }

    await page.focus("input.form-control");
    await page.keyboard.type("*:60000");

    page.waitFor(1000);

    const connection_gdb = await page.evaluate(() => {
      let top_div = document.getElementById("top");
      if (top_div == null) {
        return false;
      }

      let connect_button:HTMLElement = top_div.querySelectorAll("button.btn-primary")[1] as HTMLElement;
      if (
        connect_button == null ||
        connect_button.innerText != "Connect to mpi-gdbserver"
      ) {
        return false;
      }

      connect_button.click();

      return true;
    });

    console.log("Connecting to MPI gdbservers", connection_gdb);

    await page.waitFor(4000);

    const break_on_line = await page.evaluate(() => {
      let source_break_point:HTMLElement = document.querySelector("tr.paused_on_line") as HTMLElement;
      if (source_break_point == null) {
        return false;
      }

      let line_num:HTMLElement = source_break_point.querySelector("td.line_num div") as HTMLElement;
      if (line_num == null) {
        return false;
      }

      return line_num.innerHTML;
    });

    console.log("Check the program load and breakpoint:", break_on_line);

    const break_on_line_40 = await page.evaluate(() => {
      let source_break_point:HTMLElement = document.querySelectorAll("td.line_num")[39] as HTMLElement;
      if (source_break_point == null) {
        return false;
      }

      if (source_break_point.innerHTML != "<div>40</div>") {
        return false;
      }

      source_break_point.click();
      return true;
    });

    console.log("Setting breakpoint on line 40:", break_on_line_40);
    if (break_on_line_40 == false) {
      await close_test(browser, exe_python_server, exe_gdb_server)
      return false;
    }

    await page.waitFor(1000);

    const confirm_break_on_line_40 = await page.evaluate(() => {
      let breakpoints = document.querySelectorAll<HTMLElement>("td.line_num.breakpoint");
      if (breakpoints.length < 2) {
        return false;
      }

      if (breakpoints[1].innerHTML != "<div>40</div>") {
        return false;
      }

      return true;
    });

    console.log("Confirm breakpoint on line 40:", confirm_break_on_line_40);

    const continue_execution = await page.evaluate(() => {
      let continue_button:HTMLElement = document.getElementById("continue_button") as HTMLElement;
      if (continue_button == null) {
        return false;
      }

      continue_button.click();
      return true;
    });

    console.log("Press continue button:", continue_execution);

    await page.waitFor(4000);

    const break_on_line2 = await page.evaluate(() => {
      let source_break_point:HTMLElement = document.querySelector("tr.paused_on_line") as HTMLElement;
      if (source_break_point == null) {
        return false;
      }

      let line_num:HTMLElement = source_break_point.querySelector("td.line_num div") as HTMLElement;
      if (line_num == null) {
        return false;
      }

      return line_num.innerHTML;
    });

    console.log("Check the program break on 40:", break_on_line2);

    await page.click("body");
    await page.keyboard.down("ArrowRight");
    await page.keyboard.up("ArrowRight");
    await page.waitFor(1000);

    const single_step_divergence = await page.evaluate(() => {
      let source_break_point_on_focus:HTMLElement = document.querySelector("tr.paused_on_line") as HTMLElement;
      if (source_break_point_on_focus == null) {
        return false;
      }

      let source_break_point_not_on_focus:HTMLElement = document.querySelector("tr.paused_on_line2") as HTMLElement;
      if (source_break_point_not_on_focus == null) {
        return false;
      }

      let line_num:HTMLElement = source_break_point_on_focus.querySelector("td.line_num div") as HTMLElement;
      if (parseInt(line_num.innerHTML) != 43) {
        return false;
      }

      line_num = source_break_point_not_on_focus.querySelector("td.line_num div") as HTMLElement;
      if (parseInt(line_num.innerHTML) != 60) {
        return false;
      }

      return true;
    });

    console.log("Single step:", single_step_divergence);

    // Check add variable
    await page.focus("#expressions_input");
    await page.keyboard.type("world_rank");
    await page.keyboard.press("Enter");

    await page.waitFor(1000);

    const add_expression = await page.evaluate(() => {
      let varLi = document.querySelectorAll<HTMLElement>("li.varLI");
      if (varLi.length != 1) {
        return false;
      }

      let var_name:HTMLElement = varLi[0].querySelector("span") as HTMLElement;
      if (var_name == null) {
        return false;
      }

      let var_value:HTMLElement = varLi[0].querySelector("span.gdbVarValue") as HTMLElement;
      if (var_value == null) {
        return false;
      }

      if (var_name.innerText != "world_rank\xa0") {
        return false;
      }

      return var_value.innerText;
    });

    console.log("Expression check world_rank:", add_expression);

    // Change focus proc3

    await page.click("#rect_proc_3");
    await page.waitFor(1000);

    const add_expression2 = await page.evaluate(() => {
      let varLi = document.querySelectorAll<HTMLElement>("li.varLI");
      if (varLi.length != 1) {
        return false;
      }

      let var_name:HTMLElement = varLi[0].querySelector("span") as HTMLElement;
      if (var_name == null) {
        return false;
      }

      let var_value:HTMLElement = varLi[0].querySelector("span.gdbVarValue") as HTMLElement;
      if (var_value == null) {
        return false;
      }

      if (var_name.innerText != "world_rank\xa0") {
        return false;
      }

      return var_value.innerText;
    });

    console.log("Expression check world_rank:", add_expression2);

    await close_test(browser, exe_python_server, exe_gdb_server)

    return true;
  })().then(ret => {
    expect(ret).equal(true);
  });
}, 100000);
