define([
  "jquery",
  "base/js/namespace",
  "notebook/js/codecell",
  "base/js/dialog",
], function ($, Jupyter, codecell, dialog) {
  "use strict";

  var mod_id = "ia-feature-buttons-id";

  var gpt_api_key = "";

  function enable_buttons() {
    $(`#${mod_id}`).removeAttr("disabled");
  }

  function disable_buttons() {
    $(`#${mod_id}`).attr("disabled");
  }

  function open_gpt_api_key_modal() {
    disable_buttons();
    var textarea = $("<textarea/>")
      .attr("name", "gpt_api_key")
      .css("width", "100%")
      .attr("id", `text_area_${mod_id}`);

    var error_div = $("<div/>").css("color", "red");

    var dialogform = $("<div/>")
      .attr("title", "Edit the GPT Api Key")
      .append(
        $("<form/>").append(
          $("<fieldset/>")
            .append(
              $("<label/>")
                .attr("for", "gpt_api_key")
                .text("Please, set your key:")
            )
            .append(error_div)
            .append($("<br/>"))
            .append(textarea)
        )
      );

    dialog.modal({
      title: "Error, missing or wrong GPT Api Key",
      body: dialogform,
      buttons: {
        OK: {
          class: "btn-primary",
          click: function () {
            var new_md = $(`#text_area_${mod_id}`).val();
            Jupyter.notebook.apply_directionality();
            gpt_api_key = new_md;
            window.localStorage.setItem("gpt_api_key", new_md);
            enable_buttons();
            window.location.reload();
          },
        },
        Cancel: {},
      },
      notebook: Jupyter.notebook,
      keyboard_manager: Jupyter.notebook.keyboard_manager,
    });
  }

  function get_gpt_completion(cell, prefix, code, error) {
    var cell_text = cell.get_text();
    var data = {
      model: "text-davinci-003",
      max_tokens: 1000,
      prompt:
        prefix === "fix"
          ? `fix the code in python: \n ${code}${
              error ? `\n with the following error: \n ${error}` : ""
            }`
          : prefix === "improve"
          ? `improve the code in python: \n ${code}`
          : `transform this comment in a python code adding comment for logical explanations: \n ${code}`,
    };

    (async () => {
      const rawResponse = await fetch("https://api.openai.com/v1/completions", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${gpt_api_key}`,
        },
        body: JSON.stringify(data),
      });
      const content = await rawResponse.json();

      console.log(content);

      // Threat invalid api key

      if (content.choices) {
        var commented_text = cell_text
          ? prefix === "c2c"
            ? cell_text
            : cell_text
                .split("\n")
                .reduce(
                  (prev, next, index) =>
                    `${prev ? `${!index ? "#" : ""}${prev}\n` : ""}#${next}`,
                  ""
                )
          : "";
        cell_text =
          (prefix === "c2c" ? cell_text : commented_text) +
          "\n" +
          content.choices[0].text;
        cell.set_text(cell_text);
      }
    })();
  }

  // Jupyter.notebook.get_selected_cell().code_mirror
  function run_improve_selected_cell(env) {
    // var cell = Jupyter.notebook.get_selected_cell().code_mirror
    var cell = Jupyter.notebook.get_selected_cell();

    if (cell instanceof codecell.CodeCell) {
      const obj_cell = JSON.parse(JSON.stringify(cell));
      get_gpt_completion(cell, "improve", obj_cell.source);
    }
  }

  function run_fix_selected_cell() {
    // var cell = Jupyter.notebook.get_selected_cell().code_mirror
    var cell = Jupyter.notebook.get_selected_cell();

    if (cell instanceof codecell.CodeCell) {
      const obj_cell = JSON.parse(JSON.stringify(cell));
      get_gpt_completion(
        cell,
        "improve",
        obj_cell.source,
        obj_cell.outputs ? obj_cell.outputs.evalue : ""
      );
    }
  }

  function run_comment_to_code_on_selected_cell() {
    // var cell = Jupyter.notebook.get_selected_cell().code_mirror
    var cell = Jupyter.notebook.get_selected_cell();

    if (cell instanceof codecell.CodeCell) {
      const obj_cell = JSON.parse(JSON.stringify(cell));
      get_gpt_completion(cell, "c2c", obj_cell.source, cell);
    }
  }

  var load_ipython_extension = function () {
    console.log(Jupyter);
    gpt_api_key = window.localStorage.getItem("gpt_api_key");

    if (!gpt_api_key || gpt_api_key === "undefined") open_gpt_api_key_modal();

    if (!gpt_api_key || gpt_api_key === "undefined") return;

    // register action
    var prefix = "auto";

    var action_name = "run-improve-selected-cell";
    var action = {
      icon: "fa-bolt",
      help: "Run improvements for selected cell",
      help_index: "zz",
      handler: run_improve_selected_cell,
    };
    var improve_selected_cell =
      Jupyter.notebook.keyboard_manager.actions.register(
        action,
        action_name,
        prefix
      );

    var action_name = "run-fix-selected-cell";
    var action = {
      icon: "fa-bug",
      help: "Run fixes for selected cell",
      help_index: "zz",
      handler: run_fix_selected_cell,
    };
    var fix_selected_cell = Jupyter.notebook.keyboard_manager.actions.register(
      action,
      action_name,
      prefix
    );

    var action_name = "run-comment-to-code-on-selected-cell";
    var action = {
      icon: "fa-cc",
      help: "Run comment to code on selected cell",
      help_index: "zz",
      handler: run_comment_to_code_on_selected_cell,
    };
    var comment_to_code_on_selected_cell =
      Jupyter.notebook.keyboard_manager.actions.register(
        action,
        action_name,
        prefix
      );

    // add toolbar button
    Jupyter.toolbar.add_buttons_group(
      [
        improve_selected_cell,
        fix_selected_cell,
        comment_to_code_on_selected_cell,
      ],
      mod_id
    );
  };

  return {
    load_ipython_extension: load_ipython_extension,
  };
});
