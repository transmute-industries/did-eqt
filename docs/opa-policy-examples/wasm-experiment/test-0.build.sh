
./opa build -t wasm -e example/hello ./policies/test-0.rego

tar -xzf ./bundle.tar.gz /policy.wasm

mv ./policy.wasm ./policies/test-0.wasm

rm ./bundle.tar.gz