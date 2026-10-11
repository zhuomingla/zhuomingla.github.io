---
title: 一个笨蛋想安装arch是不是搞错了什么
date: 2026-10-11 16:33:46
tags:
    - 日常
    - linux
---
今天在ai大人的帮助下在我的surface go上安装了linux，顺便生成了博客记录下……  


---

# 在 Surface Go 1 上折腾 Arch Linux + niri：从 ChromeOS 制作启动盘到日常使用

## 背景

手头有一台闲置的 Surface Go 1（4GB 内存 / 64GB eMMC），想体验轻量、现代的 Linux 桌面，最终选择了 **Arch Linux + niri**。niri 是一个可滚动平铺的 Wayland 合成器，搭配 Waybar 后既美观又高效。

这篇文章记录整个安装与配置过程，方便以后回顾，也希望能帮到有类似需求的人。

---

## 一、准备工作：在 ChromeOS 上制作 Arch 启动盘

Surface Go 无法从 SD 卡启动，所以必须用 **U 盘**。我手头只有 ChromeOS 笔记本，制作启动盘的关键是开启 Linux 开发环境（Crostini），用 `dd` 写入 ISO。

### 1. 开启 Linux 开发环境
ChromeOS 设置 → 开发者 → Linux 开发环境 → 启用。

### 2. 下载 Arch ISO
在 Crostini 终端中：
```bash
wget https://mirrors.edge.kernel.org/archlinux/iso/latest/archlinux-x86_64.iso
```

### 3. 确认 U 盘设备名
插入 U 盘，然后：
```bash
lsblk
```
找到容量匹配的设备，通常是 `/dev/sda`。**务必确认，不要选错成系统盘。**

### 4. 用 dd 写入
```bash
sudo dd if=~/archlinux-x86_64.iso of=/dev/sda bs=4M status=progress
sync
```
写入完成后，`lsblk` 应该能看到 `sda1` 约 1.3G、`sda2` 约 264M，说明成功。

> **踩坑**：如果 ChromeOS 里无法识别 U 盘，需要在设置中把 USB 设备共享给 Linux。另外，部分 U 盘有写保护，可用 `sudo hdparm -r0 /dev/sda` 解锁。

---

## 二、在 Surface Go 1 上安装 Arch Linux

### 1. 进入 UEFI 并关闭 Secure Boot
- 关机后，按住 **音量加 + 电源** 进入 UEFI。
- Security → Secure Boot → Disabled。
- Boot configuration → 确保 “Enable Boot from USB Devices” 开启，并把 USB Storage 调到最前。

### 2. 从 U 盘启动
- 关机，按住 **音量减 + 电源**，选择 U 盘。
- 如果没出现，可在 Windows 中按住 Shift 重启 → 使用设备 → 选择 U 盘。

### 3. 联网
进入 Live 环境后，用 `iwctl` 连接 Wi-Fi：
```bash
iwctl
device list
station wlan0 scan
station wlan0 get-networks
station wlan0 connect "你的WiFi"
exit
```
测试：`ping -c 4 archlinux.org`

> **注意**：Surface Go 1 的 Marvell 网卡在 Live 环境可能缺固件，如果扫不到网络，可用手机 USB 共享网络。

### 4. 分区
确认内置硬盘（通常是 `/dev/nvme0n1`）：
```bash
lsblk
cfdisk /dev/nvme0n1
```
- 新建 GPT 分区表。
- 创建 512M 的 EFI 分区，类型选 `EFI System`。
- 剩余空间全部给根分区，类型 `Linux filesystem`。
- 写入并退出。

格式化：
```bash
mkfs.fat -F 32 /dev/nvme0n1p1
mkfs.ext4 /dev/nvme0n1p2
```

### 5. 挂载与安装基础系统
```bash
mount /dev/nvme0n1p2 /mnt
mount --mkdir /dev/nvme0n1p1 /mnt/boot
pacstrap -K /mnt base linux linux-firmware
genfstab -U /mnt >> /mnt/etc/fstab
arch-chroot /mnt
```

### 6. 基础配置
```bash
ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
hwclock --systohc
echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen
echo "zh_CN.UTF-8 UTF-8" >> /etc/locale.gen
locale-gen
echo "LANG=en_US.UTF-8" > /etc/locale.conf
echo "surface-go" > /etc/hostname
passwd
pacman -S sudo vim networkmanager grub efibootmgr
systemctl enable NetworkManager
```

### 7. 安装 GRUB 与 Surface 专属修复
```bash
grub-install --target=x86_64-efi --efi-directory=/boot --bootloader-id=GRUB
grub-mkconfig -o /boot/grub/grub.cfg
mkdir -p /boot/EFI/Microsoft/Boot
cp /boot/EFI/GRUB/grubx64.efi /boot/EFI/Microsoft/Boot/bootmgfw.efi
```
> **关键**：Surface 的 UEFI 只认 `EFI/Microsoft/Boot/bootmgfw.efi`，不复制过去可能无法启动。

退出并重启：
```bash
exit
umount -R /mnt
reboot
```
拔掉 U 盘，即可进入 Arch。

---

## 三、安装 linux-surface 内核与触控板修复

### 1. 添加 Surface 仓库
```bash
curl -s https://raw.githubusercontent.com/linux-surface/linux-surface/master/pkg/keys/surface.asc | pacman-key --add -
pacman-key --lsign-key 56C464BAAC421453
echo -e "\n[linux-surface]\nServer = https://pkg.surfacelinux.com/arch/" >> /etc/pacman.conf
pacman -Syu linux-surface linux-surface-headers iptsd
```

### 2. 触控板修复
Surface Go 的触控板有时需要重载模块：
```bash
sudo modprobe -r hid_multitouch && sudo modprobe hid_multitouch
```
如果休眠后失效，可创建 `/usr/lib/systemd/system-sleep/surface-touchpad-fix` 脚本重载模块。

### 3. niri 配置触控板
在 `~/.config/niri/config.kdl` 中：
```kdl
input {
    touchpad {
        tap
        dwt
        natural-scroll
        drag true
        drag-lock
        accel-speed 0.2
        accel-profile "adaptive"
        scroll-factor 0.3
    }
}
```
> **坑**：niri 不允许出现两个 `touchpad` 块，否则配置解析失败。

---

## 四、安装 niri 与 Waybar

```bash
pacman -S niri xwayland-satellite xdg-desktop-portal-gnome xdg-desktop-portal-gtk alacritty fuzzel mako waybar swaybg swayidle swaylock udiskie
```

启动：
```bash
niri-session
```

### 配置自动登录（greetd + tuigreet）
```bash
pacman -S greetd greetd-tuigreet
```
编辑 `/etc/greetd/config.toml`，加入 `[initial_session]` 指向 `niri-session`，然后启用 `greetd`。

---

## 五、输入法 Fcitx5

```bash
pacman -S fcitx5 fcitx5-chinese-addons fcitx5-configtool fcitx5-qt fcitx5-gtk
```
在 niri 配置中加入环境变量：
```kdl
environment {
    GTK_IM_MODULE "fcitx"
    QT_IM_MODULE "fcitx"
    XMODIFIERS "@im=fcitx"
}
spawn-at-startup "fcitx5" "-d"
```
之后用 `fcitx5-configtool` 添加 Pinyin 输入法。

---

## 六、Wi-Fi 与蓝牙图形化管理

安装托盘程序：
```bash
pacman -S network-manager-applet blueman
```
在 niri 启动项加入：
```kdl
spawn-at-startup "nm-applet" "--indicator"
spawn-at-startup "blueman-applet"
```
如果操作时提示 `not authorized`，安装 polkit 代理：
```bash
pacman -S polkit-gnome
```
并在 niri 启动项加入：
```kdl
spawn-at-startup "/usr/lib/polkit-gnome/polkit-gnome-authentication-agent-1"
```
为了避免每次扫描 Wi-Fi 都输密码，可添加 polkit 规则：
```bash
sudo nano /etc/polkit-1/rules.d/49-network-manager.rules
```
内容：
```javascript
polkit.addRule(function(action, subject) {
    if (action.id.indexOf("org.freedesktop.NetworkManager.") === 0 &&
        subject.isInGroup("wheel")) {
        return polkit.Result.YES;
    }
});
```

---

## 七、Waybar 美化（使用现成配置）

直接使用社区配置 [acaibowlz/niri-setup](https://github.com/acaibowlz/niri-setup)：
```bash
git clone https://github.com/acaibowlz/niri-setup.git
cd niri-setup
./setup.sh
```
脚本会安装依赖并软链接配置文件。

---

## 八、常用命令速查

### 包管理
```bash
sudo pacman -S 包名          # 安装
sudo pacman -Syu             # 更新系统
sudo pacman -R 包名          # 卸载
sudo pacman -Ss 关键词        # 搜索
yay -S 包名                  # 从 AUR 安装
```

### 服务管理
```bash
systemctl status 服务名
sudo systemctl start/stop/enable/disable 服务名
systemctl --user restart waybar
```

### 日志
```bash
journalctl -xe
journalctl -u 服务名 -b
```

### 网络
```bash
nmcli device wifi list
nmcli device wifi connect "SSID" password "密码"
nmtui
```

### 文件与文本
```bash
cp 源 目标
mv 源 目标
rm -r 目录
nano 文件
cat 文件
grep "关键词" 文件
```

### 终端复制粘贴
- 复制：`Ctrl + Shift + C`
- 粘贴：`Ctrl + Shift + V`
- 剪贴板工具：`wl-copy` / `wl-paste`

---

## 九、踩坑记录

| 问题 | 解决方案 |
|------|----------|
| ChromeOS 无法写入 U 盘 | 在设置中把 USB 共享给 Linux，或用 `hdparm -r0` 解锁 |
| Surface 无法从硬盘启动 | 复制 `grubx64.efi` 到 `EFI/Microsoft/Boot/bootmgfw.efi` |
| 触控板无反应 | 重载 `hid_multitouch` 模块，检查 niri 配置中只有一个 `touchpad` 块 |
| Wi-Fi 扫描提示 not authorized | 安装 `polkit-gnome` 并添加 polkit 规则 |
| Waybar 图标显示方框 | 安装 Nerd Font：`ttf-jetbrains-mono-nerd` |
| 输入法无法切换 | 确保环境变量正确，Fcitx5 随 niri 启动 |

---

## 十、小结

这台 Surface Go 1 现在运行 Arch Linux + niri，日常浏览、终端、输入法、蓝牙、Wi-Fi 都正常。虽然过程有些折腾，但最终得到一个轻量、流畅、完全可控的系统，非常值得。

希望这篇记录能帮到未来的自己，也能给同样喜欢折腾的人一点参考。

---
