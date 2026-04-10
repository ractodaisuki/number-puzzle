# number-puzzle

- [Pyxel版を起動](https://ractodaisuki.github.io/number-puzzle/)
- [Three.js 3D版を起動](https://ractodaisuki.github.io/number-puzzle/three.html)

## ローカル起動

```bash
pip install pyxel
python3 number_puzzle.py
```

## GitHub Pages 更新

```bash
./scripts/build_web.sh
```

`index.html` はこのスクリプトで Pyxel の Web 版に再生成します。
公開が 404 のままなら、GitHub の `Settings > Pages` で公開ソースを `GitHub Actions` にしてください。
