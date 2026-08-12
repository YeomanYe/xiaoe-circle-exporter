(() => {
  // node_modules/fflate/esm/browser.js
  var u8 = Uint8Array;
  var u16 = Uint16Array;
  var i32 = Int32Array;
  var fleb = new u8([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5,
    0,
    /* unused */
    0,
    0,
    /* impossible */
    0
  ]);
  var fdeb = new u8([
    0,
    0,
    0,
    0,
    1,
    1,
    2,
    2,
    3,
    3,
    4,
    4,
    5,
    5,
    6,
    6,
    7,
    7,
    8,
    8,
    9,
    9,
    10,
    10,
    11,
    11,
    12,
    12,
    13,
    13,
    /* unused */
    0,
    0
  ]);
  var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  var freb = function(eb, start) {
    var b = new u16(31);
    for (var i = 0; i < 31; ++i) {
      b[i] = start += 1 << eb[i - 1];
    }
    var r = new i32(b[30]);
    for (var i = 1; i < 30; ++i) {
      for (var j = b[i]; j < b[i + 1]; ++j) {
        r[j] = j - b[i] << 5 | i;
      }
    }
    return { b, r };
  };
  var _a = freb(fleb, 2);
  var fl = _a.b;
  var revfl = _a.r;
  fl[28] = 258, revfl[258] = 28;
  var _b = freb(fdeb, 0);
  var fd = _b.b;
  var revfd = _b.r;
  var rev = new u16(32768);
  for (i = 0; i < 32768; ++i) {
    x = (i & 43690) >> 1 | (i & 21845) << 1;
    x = (x & 52428) >> 2 | (x & 13107) << 2;
    x = (x & 61680) >> 4 | (x & 3855) << 4;
    rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
  }
  var x;
  var i;
  var hMap = (function(cd, mb, r) {
    var s = cd.length;
    var i = 0;
    var l = new u16(mb);
    for (; i < s; ++i) {
      if (cd[i])
        ++l[cd[i] - 1];
    }
    var le = new u16(mb);
    for (i = 1; i < mb; ++i) {
      le[i] = le[i - 1] + l[i - 1] << 1;
    }
    var co;
    if (r) {
      co = new u16(1 << mb);
      var rvb = 15 - mb;
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          var sv = i << 4 | cd[i];
          var r_1 = mb - cd[i];
          var v = le[cd[i] - 1]++ << r_1;
          for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
            co[rev[v] >> rvb] = sv;
          }
        }
      }
    } else {
      co = new u16(s);
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
        }
      }
    }
    return co;
  });
  var flt = new u8(288);
  for (i = 0; i < 144; ++i)
    flt[i] = 8;
  var i;
  for (i = 144; i < 256; ++i)
    flt[i] = 9;
  var i;
  for (i = 256; i < 280; ++i)
    flt[i] = 7;
  var i;
  for (i = 280; i < 288; ++i)
    flt[i] = 8;
  var i;
  var fdt = new u8(32);
  for (i = 0; i < 32; ++i)
    fdt[i] = 5;
  var i;
  var flm = /* @__PURE__ */ hMap(flt, 9, 0);
  var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
  var shft = function(p) {
    return (p + 7) / 8 | 0;
  };
  var slc = function(v, s, e) {
    if (s == null || s < 0)
      s = 0;
    if (e == null || e > v.length)
      e = v.length;
    return new u8(v.subarray(s, e));
  };
  var ec = [
    "unexpected EOF",
    "invalid block type",
    "invalid length/literal",
    "invalid distance",
    "stream finished",
    "no stream handler",
    ,
    // determined by compression function
    "no callback",
    "invalid UTF-8 data",
    "extra field too long",
    "date not in range 1980-2099",
    "filename too long",
    "stream finishing",
    "invalid zip data"
    // determined by unknown compression method
  ];
  var err = function(ind, msg, nt) {
    var e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace)
      Error.captureStackTrace(e, err);
    if (!nt)
      throw e;
    return e;
  };
  var wbits = function(d, p, v) {
    v <<= p & 7;
    var o = p / 8 | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
  };
  var wbits16 = function(d, p, v) {
    v <<= p & 7;
    var o = p / 8 | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
    d[o + 2] |= v >> 16;
  };
  var hTree = function(d, mb) {
    var t = [];
    for (var i = 0; i < d.length; ++i) {
      if (d[i])
        t.push({ s: i, f: d[i] });
    }
    var s = t.length;
    var t2 = t.slice();
    if (!s)
      return { t: et, l: 0 };
    if (s == 1) {
      var v = new u8(t[0].s + 1);
      v[t[0].s] = 1;
      return { t: v, l: 1 };
    }
    t.sort(function(a, b) {
      return a.f - b.f;
    });
    t.push({ s: -1, f: 25001 });
    var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
    t[0] = { s: -1, f: l.f + r.f, l, r };
    while (i1 != s - 1) {
      l = t[t[i0].f < t[i2].f ? i0++ : i2++];
      r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
      t[i1++] = { s: -1, f: l.f + r.f, l, r };
    }
    var maxSym = t2[0].s;
    for (var i = 1; i < s; ++i) {
      if (t2[i].s > maxSym)
        maxSym = t2[i].s;
    }
    var tr = new u16(maxSym + 1);
    var mbt = ln(t[i1 - 1], tr, 0);
    if (mbt > mb) {
      var i = 0, dt = 0;
      var lft = mbt - mb, cst = 1 << lft;
      t2.sort(function(a, b) {
        return tr[b.s] - tr[a.s] || a.f - b.f;
      });
      for (; i < s; ++i) {
        var i2_1 = t2[i].s;
        if (tr[i2_1] > mb) {
          dt += cst - (1 << mbt - tr[i2_1]);
          tr[i2_1] = mb;
        } else
          break;
      }
      dt >>= lft;
      while (dt > 0) {
        var i2_2 = t2[i].s;
        if (tr[i2_2] < mb)
          dt -= 1 << mb - tr[i2_2]++ - 1;
        else
          ++i;
      }
      for (; i >= 0 && dt; --i) {
        var i2_3 = t2[i].s;
        if (tr[i2_3] == mb) {
          --tr[i2_3];
          ++dt;
        }
      }
      mbt = mb;
    }
    return { t: new u8(tr), l: mbt };
  };
  var ln = function(n, l, d) {
    return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
  };
  var lc = function(c) {
    var s = c.length;
    while (s && !c[--s])
      ;
    var cl = new u16(++s);
    var cli = 0, cln = c[0], cls = 1;
    var w = function(v) {
      cl[cli++] = v;
    };
    for (var i = 1; i <= s; ++i) {
      if (c[i] == cln && i != s)
        ++cls;
      else {
        if (!cln && cls > 2) {
          for (; cls > 138; cls -= 138)
            w(32754);
          if (cls > 2) {
            w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
            cls = 0;
          }
        } else if (cls > 3) {
          w(cln), --cls;
          for (; cls > 6; cls -= 6)
            w(8304);
          if (cls > 2)
            w(cls - 3 << 5 | 8208), cls = 0;
        }
        while (cls--)
          w(cln);
        cls = 1;
        cln = c[i];
      }
    }
    return { c: cl.subarray(0, cli), n: s };
  };
  var clen = function(cf, cl) {
    var l = 0;
    for (var i = 0; i < cl.length; ++i)
      l += cf[i] * cl[i];
    return l;
  };
  var wfblk = function(out, pos, dat) {
    var s = dat.length;
    var o = shft(pos + 2);
    out[o] = s & 255;
    out[o + 1] = s >> 8;
    out[o + 2] = out[o] ^ 255;
    out[o + 3] = out[o + 1] ^ 255;
    for (var i = 0; i < s; ++i)
      out[o + i + 4] = dat[i];
    return (o + 4 + s) * 8;
  };
  var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
    wbits(out, p++, final);
    ++lf[256];
    var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
    var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
    var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
    var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
    var lcfreq = new u16(19);
    for (var i = 0; i < lclt.length; ++i)
      ++lcfreq[lclt[i] & 31];
    for (var i = 0; i < lcdt.length; ++i)
      ++lcfreq[lcdt[i] & 31];
    var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
    var nlcc = 19;
    for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
      ;
    var flen = bl + 5 << 3;
    var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
    var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
    if (bs >= 0 && flen <= ftlen && flen <= dtlen)
      return wfblk(out, p, dat.subarray(bs, bs + bl));
    var lm, ll, dm, dl;
    wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
    if (dtlen < ftlen) {
      lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
      var llm = hMap(lct, mlcb, 0);
      wbits(out, p, nlc - 257);
      wbits(out, p + 5, ndc - 1);
      wbits(out, p + 10, nlcc - 4);
      p += 14;
      for (var i = 0; i < nlcc; ++i)
        wbits(out, p + 3 * i, lct[clim[i]]);
      p += 3 * nlcc;
      var lcts = [lclt, lcdt];
      for (var it = 0; it < 2; ++it) {
        var clct = lcts[it];
        for (var i = 0; i < clct.length; ++i) {
          var len = clct[i] & 31;
          wbits(out, p, llm[len]), p += lct[len];
          if (len > 15)
            wbits(out, p, clct[i] >> 5 & 127), p += clct[i] >> 12;
        }
      }
    } else {
      lm = flm, ll = flt, dm = fdm, dl = fdt;
    }
    for (var i = 0; i < li; ++i) {
      var sym = syms[i];
      if (sym > 255) {
        var len = sym >> 18 & 31;
        wbits16(out, p, lm[len + 257]), p += ll[len + 257];
        if (len > 7)
          wbits(out, p, sym >> 23 & 31), p += fleb[len];
        var dst = sym & 31;
        wbits16(out, p, dm[dst]), p += dl[dst];
        if (dst > 3)
          wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
      } else {
        wbits16(out, p, lm[sym]), p += ll[sym];
      }
    }
    wbits16(out, p, lm[256]);
    return p + ll[256];
  };
  var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
  var et = /* @__PURE__ */ new u8(0);
  var dflt = function(dat, lvl, plvl, pre, post, st) {
    var s = st.z || dat.length;
    var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
    var w = o.subarray(pre, o.length - post);
    var lst = st.l;
    var pos = (st.r || 0) & 7;
    if (lvl) {
      if (pos)
        w[0] = st.r >> 3;
      var opt = deo[lvl - 1];
      var n = opt >> 13, c = opt & 8191;
      var msk_1 = (1 << plvl) - 1;
      var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
      var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
      var hsh = function(i2) {
        return (dat[i2] ^ dat[i2 + 1] << bs1_1 ^ dat[i2 + 2] << bs2_1) & msk_1;
      };
      var syms = new i32(25e3);
      var lf = new u16(288), df = new u16(32);
      var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
      for (; i + 2 < s; ++i) {
        var hv = hsh(i);
        var imod = i & 32767, pimod = head[hv];
        prev[imod] = pimod;
        head[hv] = imod;
        if (wi <= i) {
          var rem = s - i;
          if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
            pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
            li = lc_1 = eb = 0, bs = i;
            for (var j = 0; j < 286; ++j)
              lf[j] = 0;
            for (var j = 0; j < 30; ++j)
              df[j] = 0;
          }
          var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
          if (rem > 2 && hv == hsh(i - dif)) {
            var maxn = Math.min(n, rem) - 1;
            var maxd = Math.min(32767, i);
            var ml = Math.min(258, rem);
            while (dif <= maxd && --ch_1 && imod != pimod) {
              if (dat[i + l] == dat[i + l - dif]) {
                var nl = 0;
                for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                  ;
                if (nl > l) {
                  l = nl, d = dif;
                  if (nl > maxn)
                    break;
                  var mmd = Math.min(dif, nl - 2);
                  var md = 0;
                  for (var j = 0; j < mmd; ++j) {
                    var ti = i - dif + j & 32767;
                    var pti = prev[ti];
                    var cd = ti - pti & 32767;
                    if (cd > md)
                      md = cd, pimod = ti;
                  }
                }
              }
              imod = pimod, pimod = prev[imod];
              dif += imod - pimod & 32767;
            }
          }
          if (d) {
            syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
            var lin = revfl[l] & 31, din = revfd[d] & 31;
            eb += fleb[lin] + fdeb[din];
            ++lf[257 + lin];
            ++df[din];
            wi = i + l;
            ++lc_1;
          } else {
            syms[li++] = dat[i];
            ++lf[dat[i]];
          }
        }
      }
      for (i = Math.max(i, wi); i < s; ++i) {
        syms[li++] = dat[i];
        ++lf[dat[i]];
      }
      pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
      if (!lst) {
        st.r = pos & 7 | w[pos / 8 | 0] << 3;
        pos -= 7;
        st.h = head, st.p = prev, st.i = i, st.w = wi;
      }
    } else {
      for (var i = st.w || 0; i < s + lst; i += 65535) {
        var e = i + 65535;
        if (e >= s) {
          w[pos / 8 | 0] = lst;
          e = s;
        }
        pos = wfblk(w, pos + 1, dat.subarray(i, e));
      }
      st.i = s;
    }
    return slc(o, 0, pre + shft(pos) + post);
  };
  var crct = /* @__PURE__ */ (function() {
    var t = new Int32Array(256);
    for (var i = 0; i < 256; ++i) {
      var c = i, k = 9;
      while (--k)
        c = (c & 1 && -306674912) ^ c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  var crc = function() {
    var c = -1;
    return {
      p: function(d) {
        var cr = c;
        for (var i = 0; i < d.length; ++i)
          cr = crct[cr & 255 ^ d[i]] ^ cr >>> 8;
        c = cr;
      },
      d: function() {
        return ~c;
      }
    };
  };
  var dopt = function(dat, opt, pre, post, st) {
    if (!st) {
      st = { l: 1 };
      if (opt.dictionary) {
        var dict = opt.dictionary.subarray(-32768);
        var newDat = new u8(dict.length + dat.length);
        newDat.set(dict);
        newDat.set(dat, dict.length);
        dat = newDat;
        st.w = dict.length;
      }
    }
    return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
  };
  var mrg = function(a, b) {
    var o = {};
    for (var k in a)
      o[k] = a[k];
    for (var k in b)
      o[k] = b[k];
    return o;
  };
  var wbytes = function(d, b, v) {
    for (; v; ++b)
      d[b] = v, v >>>= 8;
  };
  function deflateSync(data, opts) {
    return dopt(data, opts || {}, 0, 0);
  }
  var fltn = function(d, p, t, o) {
    for (var k in d) {
      var val = d[k], n = p + k, op = o;
      if (Array.isArray(val))
        op = mrg(o, val[1]), val = val[0];
      if (ArrayBuffer.isView(val))
        t[n] = [val, op];
      else {
        t[n += "/"] = [new u8(0), op];
        fltn(val, n, t, o);
      }
    }
  };
  var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
  var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
  var tds = 0;
  try {
    td.decode(et, { stream: true });
    tds = 1;
  } catch (e) {
  }
  function strToU8(str, latin1) {
    if (latin1) {
      var ar_1 = new u8(str.length);
      for (var i = 0; i < str.length; ++i)
        ar_1[i] = str.charCodeAt(i);
      return ar_1;
    }
    if (te)
      return te.encode(str);
    var l = str.length;
    var ar = new u8(str.length + (str.length >> 1));
    var ai = 0;
    var w = function(v) {
      ar[ai++] = v;
    };
    for (var i = 0; i < l; ++i) {
      if (ai + 5 > ar.length) {
        var n = new u8(ai + 8 + (l - i << 1));
        n.set(ar);
        ar = n;
      }
      var c = str.charCodeAt(i);
      if (c < 128 || latin1)
        w(c);
      else if (c < 2048)
        w(192 | c >> 6), w(128 | c & 63);
      else if (c > 55295 && c < 57344)
        c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
      else
        w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
    }
    return slc(ar, 0, ai);
  }
  var exfl = function(ex) {
    var le = 0;
    if (ex) {
      for (var k in ex) {
        var l = ex[k].length;
        if (l > 65535)
          err(9);
        le += l + 4;
      }
    }
    return le;
  };
  var wzh = function(d, b, f, fn, u, c, ce, co) {
    var fl2 = fn.length, ex = f.extra, col = co && co.length;
    var exl = exfl(ex);
    wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
    if (ce != null)
      d[b++] = 20, d[b++] = f.os;
    d[b] = 20, b += 2;
    d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
    d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
    var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
    if (y < 0 || y > 119)
      err(10);
    wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
    if (c != -1) {
      wbytes(d, b, f.crc);
      wbytes(d, b + 4, c < 0 ? -c - 2 : c);
      wbytes(d, b + 8, f.size);
    }
    wbytes(d, b + 12, fl2);
    wbytes(d, b + 14, exl), b += 16;
    if (ce != null) {
      wbytes(d, b, col);
      wbytes(d, b + 6, f.attrs);
      wbytes(d, b + 10, ce), b += 14;
    }
    d.set(fn, b);
    b += fl2;
    if (exl) {
      for (var k in ex) {
        var exf = ex[k], l = exf.length;
        wbytes(d, b, +k);
        wbytes(d, b + 2, l);
        d.set(exf, b + 4), b += 4 + l;
      }
    }
    if (col)
      d.set(co, b), b += col;
    return b;
  };
  var wzf = function(o, b, c, d, e) {
    wbytes(o, b, 101010256);
    wbytes(o, b + 8, c);
    wbytes(o, b + 10, c);
    wbytes(o, b + 12, d);
    wbytes(o, b + 16, e);
  };
  function zipSync(data, opts) {
    if (!opts)
      opts = {};
    var r = {};
    var files = [];
    fltn(data, "", r, opts);
    var o = 0;
    var tot = 0;
    for (var fn in r) {
      var _a2 = r[fn], file = _a2[0], p = _a2[1];
      var compression = p.level == 0 ? 0 : 8;
      var f = strToU8(fn), s = f.length;
      var com = p.comment, m = com && strToU8(com), ms = m && m.length;
      var exl = exfl(p.extra);
      if (s > 65535)
        err(11);
      var d = compression ? deflateSync(file, p) : file, l = d.length;
      var c = crc();
      c.p(file);
      files.push(mrg(p, {
        size: file.length,
        crc: c.d(),
        c: d,
        f,
        m,
        u: s != fn.length || m && com.length != ms,
        o,
        compression
      }));
      o += 30 + s + exl + l;
      tot += 76 + 2 * (s + exl) + (ms || 0) + l;
    }
    var out = new u8(tot + 22), oe = o, cdl = tot - o;
    for (var i = 0; i < files.length; ++i) {
      var f = files[i];
      wzh(out, f.o, f, f.f, f.u, f.c.length);
      var badd = 30 + f.f.length + exfl(f.extra);
      out.set(f.c, f.o + badd);
      wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
    }
    wzf(out, o, files.length, cdl, oe);
    return out;
  }

  // src/export-format.js
  var ILLEGAL_FILENAME = /[<>:"/\\|?*\u0000-\u001f]/g;
  function sanitizeFilename(value, fallback = "\u9E45\u5708\u5B50\u5E16\u5B50") {
    const normalized = String(value || "").normalize("NFKC").replace(ILLEGAL_FILENAME, "_").replace(/\s+/g, " ").replace(/[. ]+$/g, "").trim();
    return (normalized || fallback).slice(0, 100);
  }
  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function markdownText(value) {
    return String(value ?? "").replace(/([\\`*_{}\[\]<>#+.!|-])/g, "\\$1");
  }
  function formatBytes(size) {
    const bytes = Number(size || 0);
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }
  function renderMarkdownResources(urls, localPathByUrl, indent = "") {
    const lines = [];
    for (const url of urls || []) {
      const localPath = localPathByUrl.get(url);
      if (localPath) lines.push(`${indent}- [\u5A92\u4F53\u6587\u4EF6](${encodeURI(localPath)})`);
      else lines.push(`${indent}- \u5A92\u4F53\u4E0B\u8F7D\u5931\u8D25\uFF1A${url}`);
    }
    return lines;
  }
  function renderMarkdownComment(comment, localPathByUrl, depth = 0) {
    const indent = "  ".repeat(depth);
    const role = comment.role ? ` \xB7 ${markdownText(comment.role)}` : "";
    const location = comment.location ? ` \xB7 ${markdownText(comment.location)}` : "";
    const time = markdownText(comment.createdAt || comment.displayTime || "\u65F6\u95F4\u672A\u77E5");
    const lines = [
      `${indent}- **${markdownText(comment.author)}${role}** \xB7 ${time}${location}`
    ];
    if (comment.text) lines.push(`${indent}  ${markdownText(comment.text).replaceAll("\n", `
${indent}  `)}`);
    lines.push(...renderMarkdownResources(comment.resources, localPathByUrl, `${indent}  `));
    for (const reply of comment.replies || []) {
      lines.push(...renderMarkdownComment(reply, localPathByUrl, depth + 1));
    }
    return lines;
  }
  function buildMarkdown(data, localPathByUrl = /* @__PURE__ */ new Map()) {
    const { post, community, comments } = data;
    const lines = [
      `# ${markdownText(post.title)}`,
      "",
      `- \u793E\u7FA4\uFF1A${markdownText(community.title)}`,
      `- \u4F5C\u8005\uFF1A${markdownText(post.author)}`,
      `- \u65F6\u95F4\uFF1A${markdownText(post.createdAt || post.displayTime || "\u65F6\u95F4\u672A\u77E5")}`,
      `- IP \u5C5E\u5730\uFF1A${markdownText(post.location || "\u672A\u663E\u793A")}`,
      `- \u6765\u6E90\uFF1A${data.sourceUrl}`,
      `- \u5BFC\u51FA\u65F6\u95F4\uFF1A${data.exportedAt}`,
      "",
      "## \u6B63\u6587",
      "",
      post.text || "\uFF08\u65E0\u6587\u5B57\u6B63\u6587\uFF09",
      "",
      "## \u9644\u4EF6",
      ""
    ];
    if (post.attachments.length === 0) {
      lines.push("\uFF08\u65E0\u9644\u4EF6\uFF09");
    } else {
      for (const attachment of post.attachments) {
        const path = localPathByUrl.get(attachment.url);
        const size = formatBytes(attachment.size);
        lines.push(
          path ? `- [${markdownText(attachment.name)}](${encodeURI(path)})${size ? ` \xB7 ${size}` : ""}` : `- ${markdownText(attachment.name)} \xB7 \u4E0B\u8F7D\u5931\u8D25 \xB7 ${attachment.url}`
        );
      }
    }
    lines.push("", `## \u8BC4\u8BBA\uFF08${comments.length} \u6761\u4E00\u7EA7\u8BC4\u8BBA\uFF09`, "");
    if (comments.length === 0) lines.push("\uFF08\u6682\u65E0\u8BC4\u8BBA\uFF09");
    for (const comment of comments) lines.push(...renderMarkdownComment(comment, localPathByUrl));
    return `${lines.join("\n")}
`;
  }
  function renderHtmlMedia(urls, localPathByUrl) {
    return (urls || []).map((url) => {
      const path = localPathByUrl.get(url);
      return path ? `<a class="media" href="${escapeHtml(path)}"><img src="${escapeHtml(path)}" alt="\u8BC4\u8BBA\u5A92\u4F53" loading="lazy"></a>` : `<p class="download-error">\u5A92\u4F53\u4E0B\u8F7D\u5931\u8D25\uFF1A${escapeHtml(url)}</p>`;
    }).join("");
  }
  function renderHtmlComment(comment, localPathByUrl, depth = 0) {
    const role = comment.role ? `<span class="role">${escapeHtml(comment.role)}</span>` : "";
    const meta = [comment.createdAt || comment.displayTime, comment.location].filter(Boolean).join(" \xB7 ");
    const replies = (comment.replies || []).map((reply) => renderHtmlComment(reply, localPathByUrl, depth + 1)).join("");
    return `<article class="comment ${depth ? "comment--reply" : ""}">
    <header><strong>${escapeHtml(comment.author)}</strong>${role}<span>${escapeHtml(meta)}</span></header>
    ${comment.text ? `<p>${escapeHtml(comment.text).replaceAll("\n", "<br>")}</p>` : ""}
    <div class="media-list">${renderHtmlMedia(comment.resources, localPathByUrl)}</div>
    ${replies ? `<div class="replies">${replies}</div>` : ""}
  </article>`;
  }
  function buildHtml(data, localPathByUrl = /* @__PURE__ */ new Map()) {
    const attachments = data.post.attachments.length ? data.post.attachments.map((attachment) => {
      const path = localPathByUrl.get(attachment.url);
      return path ? `<li><a href="${escapeHtml(path)}">${escapeHtml(attachment.name)}</a><span>${escapeHtml(formatBytes(attachment.size))}</span></li>` : `<li class="download-error">${escapeHtml(attachment.name)}\uFF08\u4E0B\u8F7D\u5931\u8D25\uFF09</li>`;
    }).join("") : "<li>\u65E0\u9644\u4EF6</li>";
    const comments = data.comments.length ? data.comments.map((comment) => renderHtmlComment(comment, localPathByUrl)).join("") : '<p class="empty">\u6682\u65E0\u8BC4\u8BBA</p>';
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(data.post.title)}</title>
  <style>
    :root{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#202738;background:#f5f6f8}
    *{box-sizing:border-box}body{max-width:880px;margin:0 auto;padding:32px 20px 72px}main{background:#fff;border:1px solid #e8eaf0;border-radius:18px;padding:32px;box-shadow:0 12px 40px #18213a0d}
    h1{font-size:28px;line-height:1.35;margin:0 0 12px}.meta{color:#737d91;font-size:14px;line-height:1.8}.content{margin:26px 0;white-space:pre-wrap;font-size:16px;line-height:1.9}
    h2{margin-top:34px;padding-bottom:10px;border-bottom:1px solid #eceef3;font-size:19px}a{color:#2f6ce5;text-decoration:none}ul{padding-left:20px}li{margin:8px 0}li span{margin-left:8px;color:#8991a2;font-size:12px}
    .comment{padding:18px 0;border-bottom:1px solid #eef0f4}.comment header{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.comment header span{color:#8a93a5;font-size:12px}.comment p{line-height:1.75;margin:10px 0 0}.comment--reply{margin-left:20px;padding:14px 16px;border:0;border-left:3px solid #e7ebf4;background:#f8f9fc}.role{padding:2px 7px;border-radius:999px;color:#866500!important;background:#fff0b3}
    .media-list{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.media img{display:block;max-width:240px;max-height:240px;border-radius:8px;border:1px solid #e4e7ed}.download-error{color:#b34141!important}.empty{color:#8991a2}@media(max-width:600px){body{padding:0}main{border:0;border-radius:0;padding:22px}h1{font-size:23px}}
  </style>
</head>
<body><main>
  <h1>${escapeHtml(data.post.title)}</h1>
  <div class="meta">\u793E\u7FA4\uFF1A${escapeHtml(data.community.title)}<br>\u4F5C\u8005\uFF1A${escapeHtml(data.post.author)} \xB7 ${escapeHtml(data.post.createdAt || data.post.displayTime)}${data.post.location ? ` \xB7 ${escapeHtml(data.post.location)}` : ""}<br>\u6765\u6E90\uFF1A<a href="${escapeHtml(data.sourceUrl)}">\u6253\u5F00\u539F\u5E16</a></div>
  <section class="content">${escapeHtml(data.post.text || "\uFF08\u65E0\u6587\u5B57\u6B63\u6587\uFF09")}</section>
  <h2>\u9644\u4EF6</h2><ul>${attachments}</ul>
  <h2>\u8BC4\u8BBA</h2>${comments}
</main></body></html>`;
  }
  function buildArchiveReadme(data, failedDownloads = []) {
    const lines = [
      "\u9E45\u5708\u5B50\u5E16\u5B50\u5BFC\u51FA\u5305",
      "================",
      "",
      `\u5E16\u5B50\uFF1A${data.post.title}`,
      `\u6765\u6E90\uFF1A${data.sourceUrl}`,
      `\u5BFC\u51FA\uFF1A${data.exportedAt}`,
      "",
      "\u6587\u4EF6\u8BF4\u660E\uFF1A",
      "- index.html\uFF1A\u53EF\u76F4\u63A5\u7528\u6D4F\u89C8\u5668\u6253\u5F00\u7684\u9605\u8BFB\u7248",
      "- \u5E16\u5B50.md\uFF1AMarkdown \u7248\u6B63\u6587\u4E0E\u8BC4\u8BBA",
      "- post.json\uFF1A\u7ED3\u6784\u5316\u6570\u636E\uFF08\u4E0D\u542B\u9690\u85CF\u7684\u7CBE\u786E IP \u548C\u5185\u90E8\u7528\u6237\u6807\u8BC6\uFF09",
      "- files/\uFF1A\u5E16\u5B50\u9644\u4EF6",
      "- media/\uFF1A\u5E16\u5B50\u53CA\u8BC4\u8BBA\u4E2D\u7684\u56FE\u7247\u3001\u97F3\u9891\u6216\u89C6\u9891"
    ];
    if (failedDownloads.length) {
      lines.push("", "\u4E0B\u8F7D\u5931\u8D25\uFF1A", ...failedDownloads.map((item) => `- ${item.url}\uFF1A${item.error}`));
    }
    return `${lines.join("\n")}
`;
  }

  // src/offscreen.js
  var MAX_ARCHIVE_BYTES = 500 * 1024 * 1024;
  var MIME_EXTENSIONS = /* @__PURE__ */ new Map([
    ["application/pdf", ".pdf"],
    ["image/jpeg", ".jpg"],
    ["image/png", ".png"],
    ["image/gif", ".gif"],
    ["image/webp", ".webp"],
    ["audio/mpeg", ".mp3"],
    ["audio/mp4", ".m4a"],
    ["video/mp4", ".mp4"]
  ]);
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "XIAOE_BUILD_ARCHIVE") return void 0;
    buildAndDownload(message.payload, message.jobId).then((result) => sendResponse({ ok: true, ...result })).catch(
      (error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
    );
    return true;
  });
  async function buildAndDownload(data, jobId) {
    const entries = {};
    const localPathByUrl = /* @__PURE__ */ new Map();
    const usedPaths = /* @__PURE__ */ new Set();
    const failures = [];
    let totalBytes = 0;
    for (let index = 0; index < data.resources.length; index += 1) {
      const resource = data.resources[index];
      sendProgress(jobId, {
        state: "working",
        message: `\u6B63\u5728\u4E0B\u8F7D\u6587\u4EF6 ${index + 1}/${data.resources.length}\u2026`
      });
      try {
        const response = await fetch(resource.url, { credentials: "include" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        totalBytes += bytes.byteLength;
        if (totalBytes > MAX_ARCHIVE_BYTES) {
          throw new Error("\u9644\u4EF6\u603B\u5927\u5C0F\u8D85\u8FC7 500 MB \u7684\u5B89\u5168\u4E0A\u9650\u3002");
        }
        const contentType = response.headers.get("content-type")?.split(";")[0] || "";
        const path = makeResourcePath(resource, index, contentType, usedPaths);
        entries[path] = bytes;
        localPathByUrl.set(resource.url, path);
      } catch (error) {
        failures.push({
          url: resource.url,
          kind: resource.kind,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    if (failures.length) {
      const firstFailure = failures[0];
      throw new Error(
        `\u6709 ${failures.length} \u4E2A\u6587\u4EF6\u4E0B\u8F7D\u5931\u8D25\uFF0C\u5DF2\u505C\u6B62\u5BFC\u51FA\u4EE5\u907F\u514D\u751F\u6210\u4E0D\u5B8C\u6574\u538B\u7F29\u5305\uFF1A${firstFailure.error}`
      );
    }
    entries["index.html"] = strToU8(buildHtml(data, localPathByUrl));
    entries["\u5E16\u5B50.md"] = strToU8(buildMarkdown(data, localPathByUrl));
    entries["post.json"] = strToU8(
      `${JSON.stringify({ ...data, resources: data.resources.map((item) => ({ ...item, localPath: localPathByUrl.get(item.url) })) }, null, 2)}
`
    );
    entries["README.txt"] = strToU8(buildArchiveReadme(data, failures));
    sendProgress(jobId, { state: "working", message: "\u6B63\u5728\u751F\u6210 ZIP \u538B\u7F29\u5305\u2026" });
    const zipped = zipSync(entries, { level: 0 });
    const blobUrl = URL.createObjectURL(new Blob([zipped], { type: "application/zip" }));
    const timestamp = data.exportedAt.replace(/[:.]/g, "-").slice(0, 19);
    const filename = `${sanitizeFilename(data.post.title)}-${timestamp}.zip`;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 6e4);
    return { blobUrl, filename, resourceCount: data.resources.length };
  }
  function makeResourcePath(resource, index, contentType, usedPaths) {
    let name = resource.name;
    if (!name) {
      try {
        name = decodeURIComponent(new URL(resource.url).pathname.split("/").filter(Boolean).at(-1));
      } catch {
        name = "";
      }
    }
    name = sanitizeFilename(name || `\u8D44\u6E90-${index + 1}`, `\u8D44\u6E90-${index + 1}`);
    if (!/\.[a-z0-9]{1,8}$/i.test(name)) name += MIME_EXTENSIONS.get(contentType) || "";
    const directory = resource.kind === "attachment" ? "files" : resource.kind === "post-media" ? "media/post" : `media/comments/${sanitizeFilename(resource.ownerId, "unknown")}`;
    let candidate = `${directory}/${name}`;
    let suffix = 2;
    while (usedPaths.has(candidate)) {
      const dot = name.lastIndexOf(".");
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const extension = dot > 0 ? name.slice(dot) : "";
      candidate = `${directory}/${stem}-${suffix}${extension}`;
      suffix += 1;
    }
    usedPaths.add(candidate);
    return candidate;
  }
  function sendProgress(jobId, progress) {
    chrome.runtime.sendMessage({ type: "XIAOE_ARCHIVE_PROGRESS", jobId, ...progress }).catch(() => void 0);
  }
})();
