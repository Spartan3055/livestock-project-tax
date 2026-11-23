/* Project Ledger calculator. Runs only in this browser tab. Nothing is saved, sent, or stored. */
(function (root) {
  "use strict";

  // 2026 figures. Sources: Rev. Proc. 2025-32 sections 3.02 and 3.14 (final);
  // draft 2026 Instructions for Form 8615 ($2,700); Instructions for Forms 1099-MISC and 1099-NEC (Rev. December 2026) ($2,000);
  // Pub. 501 (2025) Table 2 for the structure of the dependent filing test; Pub. 225 for SE tax (92.35%, 15.3%, $400).
  var F = {
    taxYear: 2026,
    depMin: 1350,          // dependent standard deduction floor and unearned-income filing line (Rev. Proc. 2025-32)
    depAdd: 450,           // earned income + $450 (Rev. Proc. 2025-32)
    singleStd: 16100,      // basic standard deduction, single (Rev. Proc. 2025-32)
    kiddie: 2700,          // Form 8615 applies above this unearned income (draft 2026 i8615)
    form1099: 2000,        // 1099-MISC box 3 reporting threshold for payments after 2025 (i1099mec Rev. Dec 2026)
    seMin: 400,            // net earnings from self-employment filing line (Pub. 501, Pub. 225)
    seFactor: 0.9235,      // Pub. 225
    seRate: 0.153          // Pub. 225
  };

  function num(v) {
    if (v === null || v === undefined) return 0;
    var n = parseFloat(String(v).replace(/[$,\s]/g, ""));
    return isFinite(n) ? n : 0;
  }
  function r2(n) { return Math.round(n * 100) / 100; }

  function compute(inp) {
    var i = {
      auction: num(inp.auction), addons: num(inp.addons), prizes: num(inp.prizes), otherIncome: num(inp.otherIncome),
      animal: num(inp.animal), feed: num(inp.feed), vet: num(inp.vet), supplies: num(inp.supplies),
      entry: num(inp.entry), commission: num(inp.commission), otherExp: num(inp.otherExp),
      f1099: num(inp.f1099), box: inp.box || "none",
      wages: num(inp.wages), otherUnearned: num(inp.otherUnearned),
      age: inp.age || "under18", dependent: inp.dependent !== false, business: !!inp.business,
      halfSupport: !!inp.halfSupport
    };
    var gross = r2(i.auction + i.addons + i.prizes + i.otherIncome);
    var expenses = r2(i.animal + i.feed + i.vet + i.supplies + i.entry + i.commission + i.otherExp);
    var net = r2(gross - expenses);
    var line8z = Math.max(net, 0);

    // Filing check assumes the project is NOT a trade or business, so net project income is treated as unearned.
    var unearned = r2(line8z + i.otherUnearned);
    var earned = r2(i.wages);
    var grossIncome = r2(unearned + earned);
    var stdDed = Math.max(F.depMin, Math.min(earned + F.depAdd, F.singleStd));
    var grossTestLine = Math.max(F.depMin, Math.min(earned, F.singleStd - F.depAdd) + F.depAdd);
    var reasons = [];
    if (unearned > F.depMin) reasons.push("Unearned income (" + money(unearned) + ") is more than " + money(F.depMin) + ".");
    if (earned > F.singleStd) reasons.push("Earned income (" + money(earned) + ") is more than " + money(F.singleStd) + ".");
    if (grossIncome > grossTestLine) reasons.push("Gross income (" + money(grossIncome) + ") is more than " + money(grossTestLine) + " (the larger of " + money(F.depMin) + " or earned income up to " + money(F.singleStd - F.depAdd) + " plus " + money(F.depAdd) + ").");
    var mustFile = i.dependent ? reasons.length > 0 : null;

    // If it were treated as a business (Schedule F): self-employment tax view.
    var seNet = r2(Math.max(net, 0) * F.seFactor);
    var seApplies = seNet >= F.seMin;
    var seTax = seApplies ? r2(seNet * F.seRate) : 0;

    var kiddieAgeOk = i.age === "under18" || ((i.age === "18" || i.age === "19to23student") && !i.halfSupport);
    var kiddie = unearned > F.kiddie && kiddieAgeOk;

    var flags = [];
    flags.push({ id: "earned", level: "ask", title: "Earned or unearned? Ask a tax preparer.",
      text: "This page treats project income as unearned income, which the Ohio State University Extension tax bulletin calls the \u201cmost likely\u201d treatment when the project is not a trade or business. That is not settled for every family. The answer changes the child\u2019s standard deduction, the filing test, and the kiddie tax." });
    if (i.business) {
      flags.push({ id: "se", level: "ask", title: "It may be a trade or business. Ask a tax preparer.",
        text: "You marked that the project is regular, recurring, run for profit, or part of other farming. Then it may belong on Schedule F with self-employment tax instead of Schedule 1, line 8z. " +
          (seApplies ? "For a rough sense of what is at stake: " + money(net) + " \u00d7 92.35% = " + money(seNet) + " of net earnings, and 15.3% of that is about " + money(seTax) + " of self-employment tax." : "Net earnings here would be under $400, the line where self-employment tax filing starts.") });
    }
    if (kiddie) flags.push({ id: "kiddie", level: "ask", title: "Kiddie tax may apply (Form 8615). Ask a tax preparer.",
      text: "Unearned income of " + money(unearned) + " is more than " + money(F.kiddie) + ". For a child under 18 (and some children 18 to 23), part of it may be taxed at the parent\u2019s rate on Form 8615. The 2026 Form 8615 instructions were still a draft when this page was written." });
    else if (unearned > F.kiddie) flags.push({ id: "kiddie-age", level: "note", title: "Unearned income is over " + money(F.kiddie) + ".",
      text: "Based on the age and support answers, Form 8615 may not apply, but confirm the age and support rules with a preparer." });
    if (i.box === "nec" || i.box === "other") flags.push({ id: "box", level: "ask", title: "The 1099 is not a 1099-MISC box 3. Ask a tax preparer.",
      text: "Fair auction money is usually shown as other income in box 3 of Form 1099-MISC. A 1099-NEC or another box can mean the payer treated it as pay for services, which raises the self-employment question. Ask the payer if it is a mistake." });
    if (i.f1099 > 0 && i.f1099 > gross + 0.5) flags.push({ id: "mismatch", level: "ask", title: "1099 is more than the income you entered. Ask a tax preparer.",
      text: "The 1099 shows " + money(i.f1099) + " but you entered " + money(gross) + " of total project income. Check for a missing check, add-on, or second fair. If the 1099 is wrong, ask the payer for a corrected form." });
    else if (i.f1099 > 0 && gross - i.f1099 > 0.5) flags.push({ id: "mismatch-under", level: "note", title: "You entered more income than the 1099 shows.",
      text: "That is common: prizes, premiums, or a second fair may be paid separately. All project income counts, whether or not it was on a 1099. The statement lists the 1099 amount so the numbers can be matched." });
    if (i.box === "none" && gross >= F.form1099) flags.push({ id: "no1099", level: "note", title: "No 1099, but income is " + money(F.form1099) + " or more.",
      text: "A 1099-MISC for 2026 payments may still arrive early in 2027. Income is reportable whether or not a 1099 is issued." });
    if (net < 0) flags.push({ id: "loss", level: "ask", title: "Expenses are more than income. Ask a tax preparer.",
      text: "The statement shows $0 for line 8z. Whether a project loss can be used at all depends on whether it is a trade or business; for most educational projects it can\u2019t offset other income. Keep the records anyway." });
    if (!i.dependent) flags.push({ id: "notdep", level: "ask", title: "Not a dependent. Ask a tax preparer.",
      text: "This checklist uses the 2026 rules for dependents. If no one can claim the child, use the regular filing rules in Pub. 501 instead." });
    flags.push({ id: "state", level: "note", title: "State return.",
      text: "This page covers the federal return only. Your state may have its own filing rules." });

    return { F: F, input: i, gross: gross, expenses: expenses, net: net, line8z: line8z, unearned: unearned, earned: earned,
      grossIncome: grossIncome, stdDed: stdDed, grossTestLine: grossTestLine, mustFile: mustFile, reasons: reasons,
      seNet: seNet, seApplies: seApplies, seTax: seTax, kiddie: kiddie, flags: flags };
  }

  function money(n) {
    var neg = n < 0; n = Math.abs(n);
    var s = n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
    return (neg ? "-$" : "$") + s;
  }

  root.ProjectLedger = { compute: compute, money: money, F: F };
  if (typeof module !== "undefined") module.exports = root.ProjectLedger;

  // ---------- DOM binding ----------
  if (typeof document === "undefined") return;
  function $(id) { return document.getElementById(id); }
  function val(id) { var el = $(id); return el ? el.value : ""; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function render() {
    var form = $("calc"); if (!form) return;
    var res = compute({
      auction: val("auction"), addons: val("addons"), prizes: val("prizes"), otherIncome: val("otherIncome"),
      animal: val("animal"), feed: val("feed"), vet: val("vet"), supplies: val("supplies"), entry: val("entry"),
      commission: val("commission"), otherExp: val("otherExp"), f1099: val("f1099"), box: val("box"),
      wages: val("wages"), otherUnearned: val("otherUnearned"), age: val("age"),
      dependent: $("dependent").checked, business: $("business").checked, halfSupport: $("halfSupport").checked
    });
    var m = money;
    $("out-gross").textContent = m(res.gross);
    $("out-exp").textContent = m(res.expenses);
    $("out-net").textContent = m(res.net);
    $("out-8z").textContent = m(res.line8z);

    var fc = $("filing");
    var html = "";
    if (res.mustFile === null) html = '<p class="verdict ask">Not a dependent: use the regular filing rules in Pub. 501 and ask a preparer.</p>';
    else if (res.mustFile) html = '<p class="verdict yes">Likely must file a 2026 federal return.</p><ul>' + res.reasons.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>";
    else html = '<p class="verdict no">Likely not required to file a 2026 federal return under the dependent income tests.</p><p class="tiny">Other rules can still require a return (for example, net self-employment earnings of $400 or more). Filing anyway can be simpler when a 1099 was issued.</p>';
    html += '<ul class="checks"><li>Unearned income used: <strong>' + m(res.unearned) + '</strong> (line 8z amount plus other unearned income)</li>' +
      '<li>Earned income used: <strong>' + m(res.earned) + '</strong></li>' +
      '<li>Estimated 2026 standard deduction for a dependent: <strong>' + m(res.stdDed) + '</strong></li></ul>';
    fc.innerHTML = html;

    $("flags").innerHTML = res.flags.map(function (f) {
      return '<div class="flag ' + f.level + '"><strong>' + esc(f.title) + "</strong><p>" + esc(f.text) + "</p></div>";
    }).join("");

    // Statement
    var name = val("childName").trim() || "[Child\u2019s name]";
    var proj = val("project").trim() || "[Species / project]";
    var payer = val("payer").trim();
    var rows = [["Auction sale proceeds", res.input.auction], ["Add-ons / buyer premiums", res.input.addons], ["Prizes and premiums", res.input.prizes], ["Other project income", res.input.otherIncome]];
    var erows = [["Purchase of project animal", res.input.animal], ["Feed", res.input.feed], ["Veterinary and health", res.input.vet], ["Supplies and bedding", res.input.supplies], ["Entry and registration fees", res.input.entry], ["Sale commission or fees withheld", res.input.commission], ["Other project expenses", res.input.otherExp]];
    function tr(r) { return "<tr><td>" + esc(r[0]) + '</td><td class="num">' + m(r[1]) + "</td></tr>"; }
    $("statement").innerHTML =
      "<h3>Statement attached to Form 1040, Schedule 1, line 8z \u2014 tax year 2026</h3>" +
      "<p><strong>Taxpayer:</strong> " + esc(name) + " &nbsp; <strong>Project:</strong> 4-H / FFA " + esc(proj) + "</p>" +
      "<p>Net income from a youth 4-H / FFA livestock project, reported as other income. Gross income and expenses are shown below.</p>" +
      '<table><thead><tr><th>Income</th><th class="num">Amount</th></tr></thead><tbody>' + rows.map(tr).join("") +
      '<tr class="tot"><td>Total gross project income</td><td class="num">' + m(res.gross) + "</td></tr></tbody></table>" +
      '<table><thead><tr><th>Expenses</th><th class="num">Amount</th></tr></thead><tbody>' + erows.map(tr).join("") +
      '<tr class="tot"><td>Total project expenses</td><td class="num">' + m(res.expenses) + "</td></tr></tbody></table>" +
      '<table><tbody><tr class="tot"><td>Net project income (gross income minus expenses)</td><td class="num">' + m(res.net) + "</td></tr>" +
      '<tr class="tot"><td>Amount entered on Schedule 1, line 8z</td><td class="num">' + m(res.line8z) + "</td></tr></tbody></table>" +
      (res.input.f1099 > 0 ? "<p>Form 1099-" + (res.input.box === "nec" ? "NEC" : "MISC") + " received" + (payer ? " from " + esc(payer) : "") + ": " + m(res.input.f1099) + (res.input.box === "box3" ? " (box 3, other income)" : "") + ". This amount is included in the gross income above.</p>" : "") +
      '<p class="tiny">Prepared with a free worksheet from Project Ledger. Educational only, not tax advice. Review with a tax preparer before filing.</p>';
  }

  document.addEventListener("DOMContentLoaded", function () {
    var form = $("calc"); if (!form) return;
    form.addEventListener("input", render);
    form.addEventListener("change", render);
    form.addEventListener("submit", function (e) { e.preventDefault(); render(); });
    var p = $("print"); if (p) p.addEventListener("click", function () { render(); window.print(); });
    var c = $("clear"); if (c) c.addEventListener("click", function () { setTimeout(render, 0); });
    render();
  });
})(typeof window !== "undefined" ? window : globalThis);
