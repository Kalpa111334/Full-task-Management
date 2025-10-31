import Swal from "sweetalert2";

export const showSuccess = (message: string) => {
  Swal.fire({
    icon: "success",
    title: "Success!",
    text: message,
    timer: 3000,
    showConfirmButton: false,
    toast: true,
    position: "top-end",
    customClass: {
      popup: "colored-toast",
    },
  });
};

export const showError = (message: string) => {
  Swal.fire({
    icon: "error",
    title: "Error!",
    text: message,
    timer: 3000,
    showConfirmButton: false,
    toast: true,
    position: "top-end",
    customClass: {
      popup: "colored-toast",
    },
  });
};

export const showConfirm = async (
  title: string,
  text: string
): Promise<boolean> => {
  const result = await Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: "Yes, proceed!",
    cancelButtonText: "Cancel",
  });

  return result.isConfirmed;
};
