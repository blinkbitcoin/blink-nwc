{
  description = "Nostr Wallet Connect dev environment";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    nixpkgs-docker.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    nixpkgs-docker,
    flake-utils,
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      dockerPkgs = import nixpkgs-docker {inherit system;};
      overlays = [
        (self: super: {
          nodejs = super.nodejs_20;
          pnpm = super.nodePackages.pnpm;
        })
      ];
      pkgs = import nixpkgs {inherit overlays system;};
      bufPkg =
        if pkgs.stdenv.isDarwin
        then dockerPkgs.buf
        else pkgs.buf;
      nativeBuildInputs = with pkgs;
        [
          git
          nodejs
          pnpm
          alejandra
          gnumake
          docker-compose
          tilt
          shellcheck
          shfmt
          vendir
          jq
          ytt
          bufPkg
          bats
        ];
    in
      with pkgs; {
        devShells.default = mkShell {
          inherit nativeBuildInputs;
          shellHook = ''
            export HOST_PROJECT_PATH="$(pwd)"
            export COMPOSE_PROJECT_NAME=nostr-wallet-connect
          '';
        };

        formatter = alejandra;
      });
}
